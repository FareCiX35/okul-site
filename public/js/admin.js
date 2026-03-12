(() => {
  const loginCard = document.getElementById("login-card");
  const panel = document.getElementById("panel");
  const loginForm = document.getElementById("login-form");
  const logoutBtn = document.getElementById("logout");

  if (!loginCard || !panel || !loginForm || !logoutBtn) {
    return;
  }

  const state = {
    token: localStorage.getItem("adminToken"),
    data: null
  };

  const escapeHtml = (value) => {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const api = async (path, options = {}) => {
    const headers = options.headers || {};
    if (state.token) {
      headers["x-admin-token"] = state.token;
    }
    if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    const res = await fetch(path, { ...options, headers });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({ error: "Hata" }));
      throw new Error(msg.error || "Ýþlem baþarýsýz");
    }
    return res.json();
  };

  const showPanel = async () => {
    loginCard.hidden = true;
    panel.hidden = false;
    await loadData();
  };

  const showLogin = () => {
    loginCard.hidden = false;
    panel.hidden = true;
  };

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.getElementById("password").value;
    try {
      const result = await api("/api/login", {
        method: "POST",
        body: { password }
      });
      state.token = result.token;
      localStorage.setItem("adminToken", result.token);
      await showPanel();
    } catch (err) {
      alert(err.message);
    }
  });

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("adminToken");
    state.token = null;
    showLogin();
  });

  const collections = {
    news: { fields: ["title", "date", "summary", "image", "url"] },
    announcements: { fields: ["title", "date", "summary", "url"] },
    events: { fields: ["title", "date", "time", "location", "summary", "image"] },
    projects: { fields: ["title", "summary", "image"] },
    achievements: { fields: ["title", "year", "summary"] },
    documents: { fields: ["title", "url"] },
    staff: { fields: ["name", "title", "image"] },
    gallery: { fields: ["title", "image"] }
  };

  const loadData = async () => {
    state.data = await api("/api/content");
    if (!state.data) return;
    fillSections();
    renderCollections();
  };

  const fillSections = () => {
    const settingsForm = document.querySelector("form[data-section='settings']");
    const heroForm = document.querySelector("form[data-section='hero']");
    const pagesForm = document.querySelector("form[data-section='pages']");
    if (!settingsForm || !heroForm || !pagesForm) return;

    const settings = state.data.settings || {};
    const social = settings.social || {};
    settingsForm.schoolName.value = settings.schoolName || "";
    settingsForm.tagline.value = settings.tagline || "";
    settingsForm.logoUrl.value = settings.logoUrl || "";
    settingsForm.address.value = settings.address || "";
    settingsForm.phone.value = settings.phone || "";
    settingsForm.email.value = settings.email || "";
    settingsForm.mapUrl.value = settings.mapUrl || "";
    settingsForm.instagram.value = social.instagram || "";
    settingsForm.youtube.value = social.youtube || "";
    settingsForm.x.value = social.x || "";

    const hero = state.data.hero || {};
    heroForm.title.value = hero.title || "";
    heroForm.subtitle.value = hero.subtitle || "";
    heroForm.ctaPrimary.value = hero.ctaPrimary || "";
    heroForm.ctaSecondary.value = hero.ctaSecondary || "";
    heroForm.heroImage.value = hero.heroImage || "";

    const pages = state.data.pages || {};
    pagesForm.about.value = pages.about || "";
    pagesForm.history.value = pages.history || "";
    pagesForm.principalMessage.value = pages.principalMessage || "";
    pagesForm.mission.value = pages.mission || "";
    pagesForm.vision.value = pages.vision || "";
    pagesForm.values.value = (pages.values || []).join(", ");
  };

  const renderCollections = () => {
    Object.keys(collections).forEach((name) => {
      const listEl = document.querySelector(`[data-list='${name}']`);
      if (!listEl) return;
      const items = state.data[name] || [];
      listEl.innerHTML = items
        .map((item) => {
          const title = item.name || item.title;
          const subtitle = item.date ? item.date : item.summary || item.title || "";
          return `
            <div class="collection-item">
              <div>
                <h4>${escapeHtml(title)}</h4>
                <p>${escapeHtml(subtitle)}</p>
              </div>
              <div class="item-actions">
                <button data-action="edit" data-collection="${escapeHtml(name)}" data-id="${escapeHtml(item.id)}">Düzenle</button>
                <button data-action="delete" data-collection="${escapeHtml(name)}" data-id="${escapeHtml(item.id)}">Sil</button>
              </div>
            </div>
          `;
        })
        .join("");
    });
  };

  const handleSectionSubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const section = form.dataset.section;
    if (!section) return;
    try {
      if (section === "settings") {
        const payload = {
          schoolName: form.schoolName.value,
          tagline: form.tagline.value,
          logoUrl: form.logoUrl.value,
          address: form.address.value,
          phone: form.phone.value,
          email: form.email.value,
          mapUrl: form.mapUrl.value,
          social: {
            instagram: form.instagram.value,
            youtube: form.youtube.value,
            x: form.x.value
          }
        };
        await api(`/api/section/${section}`, { method: "PUT", body: payload });
      } else if (section === "pages") {
        const values = form.values.value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        const payload = {
          about: form.about.value,
          history: form.history.value,
          principalMessage: form.principalMessage.value,
          mission: form.mission.value,
          vision: form.vision.value,
          values
        };
        await api(`/api/section/${section}`, { method: "PUT", body: payload });
      } else {
        const payload = {
          title: form.title.value,
          subtitle: form.subtitle.value,
          ctaPrimary: form.ctaPrimary.value,
          ctaSecondary: form.ctaSecondary.value,
          heroImage: form.heroImage.value
        };
        await api(`/api/section/${section}`, { method: "PUT", body: payload });
      }
      await loadData();
      alert("Kaydedildi");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCollectionSubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const collection = form.dataset.collection;
    const config = collections[collection];
    if (!config) return;
    const payload = {};
    config.fields.forEach((field) => {
      payload[field] = form[field].value;
    });
    try {
      if (form.id.value) {
        await api(`/api/collection/${collection}/${form.id.value}`, {
          method: "PUT",
          body: payload
        });
      } else {
        await api(`/api/collection/${collection}`, {
          method: "POST",
          body: payload
        });
      }
      form.reset();
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const attachFormListeners = () => {
    document.querySelectorAll("form[data-section]").forEach((form) => {
      form.addEventListener("submit", handleSectionSubmit);
    });

    document.querySelectorAll("form[data-collection]").forEach((form) => {
      form.addEventListener("submit", handleCollectionSubmit);
      const resetBtn = form.querySelector("[data-reset]");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          form.reset();
          form.id.value = "";
        });
      }
    });

    document.querySelectorAll(".collection-list").forEach((list) => {
      list.addEventListener("click", async (event) => {
        const btn = event.target.closest("button");
        if (!btn) return;
        const action = btn.dataset.action;
        const collection = btn.dataset.collection;
        const id = btn.dataset.id;
        if (!action || !collection || !id) return;

        if (action === "delete") {
          const ok = confirm("Silmek istediðinize emin misiniz?");
          if (!ok) return;
          try {
            await api(`/api/collection/${collection}/${id}`, { method: "DELETE" });
            await loadData();
          } catch (err) {
            alert(err.message);
          }
        }

        if (action === "edit") {
          const item = (state.data[collection] || []).find((entry) => entry.id === id);
          if (!item) return;
          const form = document.querySelector(`form[data-collection='${collection}']`);
          if (!form) return;
          form.id.value = item.id;
          collections[collection].fields.forEach((field) => {
            form[field].value = item[field] || "";
          });
          form.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  };

  attachFormListeners();

  const uploadForm = document.getElementById("upload-form");
  const uploadResult = document.getElementById("upload-result");

  if (uploadForm && uploadResult) {
    uploadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fileInput = uploadForm.querySelector("input[type='file']");
      if (!fileInput || !fileInput.files.length) return;
      const formData = new FormData();
      formData.append("image", fileInput.files[0]);
      try {
        const result = await api("/api/upload", { method: "POST", body: formData });
        uploadResult.innerHTML = `
          <div>Yüklendi. Görsel URL:</div>
          <code>${escapeHtml(result.url)}</code>
          <button type="button" data-copy>URL kopyala</button>
        `;
        const copyBtn = uploadResult.querySelector("[data-copy]");
        if (copyBtn) {
          copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(result.url);
            copyBtn.textContent = "Kopyalandý";
          });
        }
        fileInput.value = "";
      } catch (err) {
        alert(err.message);
      }
    });
  }

  if (state.token) {
    showPanel().catch(showLogin);
  } else {
    showLogin();
  }
})();
