import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import multer from "multer";
import { nanoid } from "nanoid";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const dataPath = path.join(__dirname, "data", "db.json");
const uploadsDir = path.join(__dirname, "public", "uploads");

const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const adminToken = process.env.ADMIN_TOKEN || "dev-token";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = process.env.SUPABASE_BUCKET || "media";
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  : null;

let seedCache = null;
const isPlainObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const getSeed = async () => {
  if (seedCache) return seedCache;
  const raw = await fs.readFile(dataPath, "utf8");
  seedCache = JSON.parse(raw);
  return seedCache;
};

const mojibakePattern = /[\u00C3\u00C5\u00C4\u00E2\u00C2\uFFFD\u0111\u0163\u00D0\u00DE\u00DD\u00FD\u00FE]/;
const isMojibake = (value) => mojibakePattern.test(value);
const fixMojibake = (value) => {
  if (typeof value !== "string" || !isMojibake(value)) return value;
  const fixed = Buffer.from(value, "latin1").toString("utf8");
  return isMojibake(fixed) ? value : fixed;
};

const sanitizeStrings = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeStrings(item));
  }
  if (isPlainObject(value)) {
    const result = {};
    Object.entries(value).forEach(([key, item]) => {
      result[key] = sanitizeStrings(item);
    });
    return result;
  }
  return fixMojibake(value);
};

const mergeWithSeed = (value, seedValue) => {
  if (seedValue === undefined) return value;
  if (Array.isArray(seedValue)) {
    return Array.isArray(value) ? value : seedValue;
  }
  if (isPlainObject(seedValue)) {
    const result = { ...seedValue };
    if (isPlainObject(value)) {
      Object.entries(value).forEach(([key, next]) => {
        result[key] = mergeWithSeed(next, seedValue[key]);
      });
    }
    return result;
  }
  if (typeof value === "string" && typeof seedValue === "string" && isMojibake(value)) {
    return seedValue;
  }
  return value ?? seedValue;
};

const storage = supabase
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          await fs.mkdir(uploadsDir, { recursive: true });
          cb(null, uploadsDir);
        } catch (err) {
          cb(err);
        }
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || ".png";
        cb(null, `${Date.now()}-${nanoid(6)}${ext}`);
      }
    });

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }
});

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
});
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, filePath) => {
    const normalized = filePath.toLowerCase();
    if (normalized.includes(`${path.sep}uploads${path.sep}`)) {
      res.setHeader("Cache-Control", "no-store");
      return;
    }
    if (/\.(css|js|svg|png|jpg|jpeg|webp)$/.test(normalized)) {
      res.setHeader("Cache-Control", "public, max-age=3600");
    }
  }
}));

async function readDb() {
  if (!supabase) {
    const seed = await getSeed();
    const raw = await fs.readFile(dataPath, "utf8");
    const data = JSON.parse(raw);
    return mergeWithSeed(data, seed);
  }

  const { data, error } = await supabase
    .from("site_content")
    .select("data")
    .eq("id", 1)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (!data) {
    const seed = await getSeed();
    const { error: upsertError } = await supabase
      .from("site_content")
      .upsert({ id: 1, data: seed });
    if (upsertError) {
      throw upsertError;
    }
    return seed;
  }

  const seed = await getSeed();
  const merged = mergeWithSeed(data.data, seed);
  return sanitizeStrings(merged);
}

async function writeDb(data) {
  if (!supabase) {
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), "utf8");
    return;
  }

  const { error } = await supabase
    .from("site_content")
    .upsert({ id: 1, data });
  if (error) {
    throw error;
  }
}

function requireAuth(req, res, next) {
  if (req.method === "GET" || req.path === "/api/login") {
    return next();
  }
  const token = req.headers["x-admin-token"];
  if (token !== adminToken) {
    return res.status(401).json({ error: "Yetkisiz" });
  }
  return next();
}

const asyncHandler = (handler) => (req, res) => {
  Promise.resolve(handler(req, res)).catch((err) => {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  });
};

const rateBuckets = new Map();
const hitRateLimit = (key, limit, windowMs) => {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start >= windowMs) {
    rateBuckets.set(key, { start: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
};

app.use(requireAuth);

app.post("/api/login", (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  if (hitRateLimit(`login:${ip}`, 8, 10 * 60 * 1000)) {
    return res.status(429).json({ error: "Çok fazla deneme. Lütfen bekleyin." });
  }
  const { password } = req.body || {};
  if (password === adminPassword) {
    return res.json({ token: adminToken });
  }
  return res.status(401).json({ error: "Hatalı şifre" });
});

app.get("/api/content", asyncHandler(async (req, res) => {
  const data = await readDb();
  res.json(data);
}));

app.get("/api/collection/:name", asyncHandler(async (req, res) => {
  const data = await readDb();
  const collection = data[req.params.name];
  if (!Array.isArray(collection)) {
    return res.status(404).json({ error: "Koleksiyon bulunamadı" });
  }
  res.json(collection);
}));

app.post("/api/collection/:name", asyncHandler(async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  if (hitRateLimit(`write:${ip}`, 120, 60 * 1000)) {
    return res.status(429).json({ error: "Çok fazla istek. Lütfen bekleyin." });
  }
  const data = await readDb();
  const collection = data[req.params.name];
  if (!Array.isArray(collection)) {
    return res.status(404).json({ error: "Koleksiyon bulunamadı" });
  }
  const item = { id: nanoid(8), ...req.body };
  collection.unshift(item);
  await writeDb(data);
  res.status(201).json(item);
}));

app.put("/api/collection/:name/:id", asyncHandler(async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  if (hitRateLimit(`write:${ip}`, 120, 60 * 1000)) {
    return res.status(429).json({ error: "Çok fazla istek. Lütfen bekleyin." });
  }
  const data = await readDb();
  const collection = data[req.params.name];
  if (!Array.isArray(collection)) {
    return res.status(404).json({ error: "Koleksiyon bulunamadı" });
  }
  const idx = collection.findIndex((item) => item.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: "Kayıt bulunamadı" });
  }
  collection[idx] = { ...collection[idx], ...req.body };
  await writeDb(data);
  res.json(collection[idx]);
}));

app.delete("/api/collection/:name/:id", asyncHandler(async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  if (hitRateLimit(`write:${ip}`, 120, 60 * 1000)) {
    return res.status(429).json({ error: "Çok fazla istek. Lütfen bekleyin." });
  }
  const data = await readDb();
  const collection = data[req.params.name];
  if (!Array.isArray(collection)) {
    return res.status(404).json({ error: "Koleksiyon bulunamadı" });
  }
  const next = collection.filter((item) => item.id !== req.params.id);
  data[req.params.name] = next;
  await writeDb(data);
  res.json({ ok: true });
}));

app.put("/api/section/:name", asyncHandler(async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  if (hitRateLimit(`write:${ip}`, 120, 60 * 1000)) {
    return res.status(429).json({ error: "Çok fazla istek. Lütfen bekleyin." });
  }
  const data = await readDb();
  if (Array.isArray(data[req.params.name])) {
    return res.status(400).json({ error: "Bu bölüm koleksiyon olarak yönetiliyor" });
  }
  data[req.params.name] = { ...data[req.params.name], ...req.body };
  await writeDb(data);
  res.json(data[req.params.name]);
}));

app.post("/api/upload", upload.single("image"), asyncHandler(async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  if (hitRateLimit(`upload:${ip}`, 30, 10 * 60 * 1000)) {
    return res.status(429).json({ error: "Çok fazla yükleme. Lütfen bekleyin." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Dosya yüklenemedi" });
  }
  if (!req.file.mimetype || !req.file.mimetype.startsWith("image/")) {
    return res.status(400).json({ error: "Sadece görsel dosyalar yüklenebilir" });
  }
  if (!supabase) {
    const url = `/uploads/${req.file.filename}`;
    return res.status(201).json({ url });
  }

  const ext = path.extname(req.file.originalname) || ".png";
  const filename = `${Date.now()}-${nanoid(6)}${ext}`;
  const filePath = `uploads/${filename}`;
  const { error } = await supabase.storage
    .from(supabaseBucket)
    .upload(filePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(filePath);
  res.status(201).json({ url: data.publicUrl });
}));

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
