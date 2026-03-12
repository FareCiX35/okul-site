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
  el.innerHTML = items.map(template).join("");
};

async function loadContent() {
  const res = await fetch("/api/content");
  const data = await res.json();

  setText("school-name", data.settings.schoolName);
  setText("school-tagline", data.settings.tagline);
  setText("footer-school-name", data.settings.schoolName);

  const logo = document.getElementById("logo");
  if (logo && data.settings.logoUrl) {
    logo.src = data.settings.logoUrl;
  }

  setText("hero-title", data.hero.title);
  setText("hero-subtitle", data.hero.subtitle);
  setText("hero-cta-primary", data.hero.ctaPrimary);
  setText("hero-cta-secondary", data.hero.ctaSecondary);

  const heroImage = document.getElementById("hero-image");
  if (heroImage) {
    heroImage.style.backgroundImage = `url('${data.hero.heroImage}')`;
  }

  const quickLinks = data.quickLinks.map((link) => {
    return `<a class="quick-link" href="${link.url}">${link.title}</a>`;
  });
  setHtml("quick-links", quickLinks.join(""));

  renderCards("stats", data.stats, (item) => {
    return `
      <div class="stat">
        <h3>${item.value}</h3>
        <p>${item.label}</p>
      </div>
    `;
  });

  setText("about-text", data.pages.about);
  setText("mission-text", data.pages.mission);
  setText("vision-text", data.pages.vision);
  setText("principal-message", data.pages.principalMessage);
  setText("history-text", data.pages.history);

  renderCards("values-list", data.pages.values, (item) => {
    return `<span class="chip">${item}</span>`;
  });

  renderCards("news-list", data.news, (item) => {
    return `
      <article class="card">
        <div class="card-media" style="background-image: url('${item.image}')"></div>
        <div class="card-body">
          <p class="meta">${formatDate(item.date)}</p>
          <h3>${item.title}</h3>
          <p>${item.summary}</p>
        </div>
      </article>
    `;
  });

  renderCards("announcements-list", data.announcements, (item) => {
    return `
      <div class="list-item">
        <div>
          <h4>${item.title}</h4>
          <p>${item.summary || ""}</p>
        </div>
        <span class="badge">${formatDate(item.date)}</span>
      </div>
    `;
  });

  renderCards("events-list", data.events, (item) => {
    return `
      <article class="card">
        <div class="card-media" style="background-image: url('${item.image}')"></div>
        <div class="card-body">
          <p class="meta">${formatDate(item.date)} · ${item.time || ""}</p>
          <h3>${item.title}</h3>
          <p>${item.summary}</p>
          <p class="meta">${item.location || ""}</p>
        </div>
      </article>
    `;
  });

  renderCards("projects-list", data.projects, (item) => {
    return `
      <article class="card">
        <div class="card-media" style="background-image: url('${item.image}')"></div>
        <div class="card-body">
          <h3>${item.title}</h3>
          <p>${item.summary}</p>
        </div>
      </article>
    `;
  });

  renderCards("achievements-list", data.achievements, (item) => {
    return `
      <article class="card">
        <div class="card-body">
          <p class="meta">${item.year}</p>
          <h3>${item.title}</h3>
          <p>${item.summary}</p>
        </div>
      </article>
    `;
  });

  renderCards("documents-list", data.documents, (item) => {
    return `
      <div class="list-item">
        <div>
          <h4>${item.title}</h4>
        </div>
        <a class="badge" href="${item.url}">İndir</a>
      </div>
    `;
  });

  renderCards("staff-list", data.staff, (item) => {
    return `
      <article class="card">
        <div class="card-media" style="background-image: url('${item.image}')"></div>
        <div class="card-body">
          <h3>${item.name}</h3>
          <p>${item.title}</p>
        </div>
      </article>
    `;
  });

  renderCards("gallery-list", data.gallery, (item) => {
    return `
      <div class="gallery-item" style="background-image: url('${item.image}')">
        <span>${item.title}</span>
      </div>
    `;
  });

  setText("contact-address", data.settings.address);
  setText("contact-phone", data.settings.phone);
  setText("contact-email", data.settings.email);

  const socialLinks = [];
  if (data.settings.social.instagram) {
    socialLinks.push(`<a href="${data.settings.social.instagram}" target="_blank" rel="noreferrer">Instagram</a>`);
  }
  if (data.settings.social.youtube) {
    socialLinks.push(`<a href="${data.settings.social.youtube}" target="_blank" rel="noreferrer">YouTube</a>`);
  }
  if (data.settings.social.x) {
    socialLinks.push(`<a href="${data.settings.social.x}" target="_blank" rel="noreferrer">X</a>`);
  }
  setHtml("social-links", socialLinks.join(""));

  const mapFrame = document.getElementById("map-frame");
  if (mapFrame) {
    mapFrame.src = data.settings.mapUrl;
  }
}

loadContent().catch(() => {
  // Silently ignore if API not ready.
});
