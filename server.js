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

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

async function readDb() {
  if (!supabase) {
    const raw = await fs.readFile(dataPath, "utf8");
    return JSON.parse(raw);
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
    const raw = await fs.readFile(dataPath, "utf8");
    const seed = JSON.parse(raw);
    const { error: upsertError } = await supabase
      .from("site_content")
      .upsert({ id: 1, data: seed });
    if (upsertError) {
      throw upsertError;
    }
    return seed;
  }

  return data.data;
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

app.use(requireAuth);

app.post("/api/login", (req, res) => {
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
  const data = await readDb();
  if (Array.isArray(data[req.params.name])) {
    return res.status(400).json({ error: "Bu bölüm koleksiyon olarak yönetiliyor" });
  }
  data[req.params.name] = { ...data[req.params.name], ...req.body };
  await writeDb(data);
  res.json(data[req.params.name]);
}));

app.post("/api/upload", upload.single("image"), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Dosya yüklenemedi" });
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
