const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
};

const escapeHtml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const safeUrl = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (raw.startsWith("#") || raw.startsWith("/")) return raw;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
  } catch {
    return "";
  }
  return "";
};

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value || "";
  }
};

const setHtml = (id, value) => {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = value || "";
  }
};

const renderCards = (container, items, template) => {
  const el = document.getElementById(container);
  if (!el) return;
  const list = Array.isArray(items) ? items : [];
  el.innerHTML = list.map(template).join("");
};

async function loadContent() {
  const res = await fetch("/api/content");
  if (!res.ok) return;
  const data = await res.json();
  if (!data) return;
  const settings = data.settings || {};
  const hero = data.hero || {};
  const pages = data.pages || {};
  const social = settings.social || {};

  setText("school-name", settings.schoolName);
  setText("school-tagline", settings.tagline);
  setText("footer-school-name", settings.schoolName);

  const logo = document.getElementById("logo");
  if (logo && settings.logoUrl) {
    const src = safeUrl(settings.logoUrl);
    if (src) logo.src = src;
  }

  setText("hero-title", hero.title);
  setText("hero-subtitle", hero.subtitle);
  setText("hero-cta-primary", hero.ctaPrimary);
  setText("hero-cta-secondary", hero.ctaSecondary);

  const heroImage = document.getElementById("hero-image");
  if (heroImage) {
    const imageUrl = safeUrl(hero.heroImage);
    heroImage.style.backgroundImage = imageUrl ? `url('${imageUrl}')` : "";
  }

  const quickLinks = (data.quickLinks || []).map((link) => {
    const href = safeUrl(link.url);
    return `<a class="quick-link" href="${escapeHtml(href)}">${escapeHtml(link.title)}</a>`;
  });
  setHtml("quick-links", quickLinks.join(""));

  renderCards("stats", data.stats, (item) => {
    return `
      <div class="stat">
        <h3>${escapeHtml(item.value)}</h3>
        <p>${escapeHtml(item.label)}</p>
      </div>
    `;
  });

  setText("about-text", pages.about);
  setText("mission-text", pages.mission);
  setText("vision-text", pages.vision);
  setText("principal-message", pages.principalMessage);
  setText("history-text", pages.history);

  renderCards("values-list", pages.values, (item) => {
    return `<span class="chip">${escapeHtml(item)}</span>`;
  });

  renderCards("news-list", data.news, (item) => {
    return `
      <article class="card">
        <div class="card-media" style="background-image: url('${safeUrl(item.image)}')"></div>
        <div class="card-body">
          <p class="meta">${escapeHtml(formatDate(item.date))}</p>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
        </div>
      </article>
    `;
  });

  renderCards("announcements-list", data.announcements, (item) => {
    return `
      <div class="list-item">
        <div>
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.summary || "")}</p>
        </div>
        <span class="badge">${escapeHtml(formatDate(item.date))}</span>
      </div>
    `;
  });

  renderCards("events-list", data.events, (item) => {
    return `
      <article class="card">
        <div class="card-media" style="background-image: url('${safeUrl(item.image)}')"></div>
        <div class="card-body">
          <p class="meta">${escapeHtml(formatDate(item.date))} � ${escapeHtml(item.time || "")}</p>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
          <p class="meta">${escapeHtml(item.location || "")}</p>
        </div>
      </article>
    `;
  });

  renderCards("projects-list", data.projects, (item) => {
    return `
      <article class="card">
        <div class="card-media" style="background-image: url('${safeUrl(item.image)}')"></div>
        <div class="card-body">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
        </div>
      </article>
    `;
  });

  renderCards("achievements-list", data.achievements, (item) => {
    return `
      <article class="card">
        <div class="card-body">
          <p class="meta">${escapeHtml(item.year)}</p>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
        </div>
      </article>
    `;
  });

  renderCards("documents-list", data.documents, (item) => {
    return `
      <div class="list-item">
        <div>
          <h4>${escapeHtml(item.title)}</h4>
        </div>
        <a class="badge" href="${escapeHtml(safeUrl(item.url))}">�ndir</a>
      </div>
    `;
  });

  renderCards("staff-list", data.staff, (item) => {
    return `
      <article class="card">
        <div class="card-media" style="background-image: url('${safeUrl(item.image)}')"></div>
        <div class="card-body">
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.title)}</p>
        </div>
      </article>
    `;
  });

  renderCards("gallery-list", data.gallery, (item) => {
    return `
      <div class="gallery-item" style="background-image: url('${safeUrl(item.image)}')">
        <span>${escapeHtml(item.title)}</span>
      </div>
    `;
  });

  setText("contact-address", settings.address);
  setText("contact-phone", settings.phone);
  setText("contact-email", settings.email);

  const socialLinks = [];
  if (social.instagram) {
    const href = safeUrl(social.instagram);
    if (href) socialLinks.push(`<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">Instagram</a>`);
  }
  if (social.youtube) {
    const href = safeUrl(social.youtube);
    if (href) socialLinks.push(`<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">YouTube</a>`);
  }
  if (social.x) {
    const href = safeUrl(social.x);
    if (href) socialLinks.push(`<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">X</a>`);
  }
  setHtml("social-links", socialLinks.join(""));

  const mapFrame = document.getElementById("map-frame");
  if (mapFrame) {
    const src = safeUrl(settings.mapUrl);
    if (src) mapFrame.src = src;
  }
}

loadContent().catch(() => {
  // Silently ignore if API not ready.
});
