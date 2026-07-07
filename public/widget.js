(function () {
  const DEFAULT_GREETING =
    "Hi, I'm Dynamic Dan. I can help with your home project, and if you'd like, you can upload an energy bill so I can point out what to review during a free energy audit.";
  const DEFAULT_LOGO_URL =
    "https://818f26934f00292465dd5e462ae004c8.cdn.bubble.io/cdn-cgi/image/w=128,h=,f=auto,dpr=1,fit=contain/f1711652873445x854805613531486300/DYN%20Favicon.png";
  const MAX_BILL_UPLOAD_BYTES = 8 * 1024 * 1024;
  const BILL_UPLOAD_TYPES = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp"
  ]);

  function getScriptOptions() {
    const script = document.currentScript;
    if (!script) {
      return {};
    }

    let scriptOrigin = "";
    try {
      scriptOrigin = new URL(script.src, window.location.href).origin;
    } catch {
      scriptOrigin = "";
    }

    return {
      apiBase: script.dataset.apiBase || scriptOrigin,
      cssUrl:
        script.dataset.cssUrl ||
        (scriptOrigin ? `${scriptOrigin}/dynamic-dan.css` : ""),
      loadCss: script.dataset.loadCss !== "false",
      target: script.dataset.target,
      floating: script.dataset.floating !== "false",
      open: script.dataset.open === "true",
      teaser: script.dataset.teaser || "Speak with an agent!",
      logoUrl: script.dataset.logoUrl || DEFAULT_LOGO_URL
    };
  }

  function ensureStylesheet(href) {
    if (!href || typeof document === "undefined") {
      return;
    }

    let absoluteHref = href;
    try {
      absoluteHref = new URL(href, window.location.href).href;
    } catch {
      absoluteHref = href;
    }

    const hasStylesheet = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(
      (link) => link.href === absoluteHref || link.getAttribute("href") === href
    );
    if (hasStylesheet || document.querySelector("link[data-dynamic-dan-css]")) {
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.dynamicDanCss = "true";
    document.head.append(link);
  }

  function iconSvg() {
    return [
      '<svg viewBox="0 0 24 24" aria-hidden="true" class="dd-icon">',
      '<path d="M4.5 5.75A3.25 3.25 0 0 1 7.75 2.5h8.5a3.25 3.25 0 0 1 3.25 3.25v6.5a3.25 3.25 0 0 1-3.25 3.25H10l-4.72 4.02a.75.75 0 0 1-1.23-.57V5.75Z" />',
      "</svg>"
    ].join("");
  }

  function expandSvg() {
    return [
      '<svg viewBox="0 0 24 24" aria-hidden="true" class="dd-action-icon">',
      '<path d="M15 3h6v6h-2V6.41l-5.3 5.3-1.4-1.42 5.29-5.29H15V3ZM10.3 12.3l1.4 1.42L6.41 19H9v2H3v-6h2v2.59l5.3-5.29Z" />',
      "</svg>"
    ].join("");
  }

  function closeSvg() {
    return [
      '<svg viewBox="0 0 24 24" aria-hidden="true" class="dd-action-icon">',
      '<path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4 6.4 5Zm11.2 0L19 6.4 6.4 19 5 17.6 17.6 5Z" />',
      "</svg>"
    ].join("");
  }

  function attachmentSvg() {
    return [
      '<svg viewBox="0 0 24 24" aria-hidden="true" class="dd-input-icon">',
      '<path d="M8.4 17.5a4 4 0 0 1 0-5.66l6.37-6.36a2.75 2.75 0 0 1 3.89 3.89l-7.07 7.07a1.5 1.5 0 0 1-2.12-2.12l6.36-6.37 1.42 1.42-6.37 6.36a.5.5 0 0 0 .7.7l7.08-7.06a4.75 4.75 0 1 0-6.72-6.72l-6.37 6.36a6 6 0 1 0 8.49 8.49l5.66-5.66 1.41 1.41-5.66 5.66a8 8 0 0 1-11.31-11.31l6.36-6.37 1.42 1.42-6.37 6.36a6 6 0 0 0 8.49 8.49l5.66-5.66 1.41 1.41-5.66 5.66a8 8 0 0 1-11.31 0Z" />',
      "</svg>"
    ].join("");
  }

  function sendSvg() {
    return [
      '<svg viewBox="0 0 24 24" aria-hidden="true" class="dd-send-icon">',
      '<path d="M13 19V7.83l4.59 4.58L19 11 12 4 5 11l1.41 1.41L11 7.83V19h2Z" />',
      "</svg>"
    ].join("");
  }

  function createElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (text) {
      el.textContent = text;
    }
    return el;
  }

  function appendLinkedText(container, text) {
    const content = String(text || "");
    const linkPattern = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
    let lastIndex = 0;

    for (const match of content.matchAll(linkPattern)) {
      const rawMatch = match[0];
      const matchIndex = match.index || 0;
      if (matchIndex > lastIndex) {
        container.append(document.createTextNode(content.slice(lastIndex, matchIndex)));
      }

      const trailingMatch = rawMatch.match(/[),.!?:;]+$/);
      const trailing = trailingMatch ? trailingMatch[0] : "";
      const displayUrl = trailing ? rawMatch.slice(0, -trailing.length) : rawMatch;
      const href = displayUrl.startsWith("http") ? displayUrl : `https://${displayUrl}`;
      const link = createElement("a", "dd-inline-link", displayUrl);
      link.href = href;
      link.target = "_blank";
      link.rel = "noreferrer";
      container.append(link);
      if (trailing) {
        container.append(document.createTextNode(trailing));
      }

      lastIndex = matchIndex + rawMatch.length;
    }

    if (lastIndex < content.length) {
      container.append(document.createTextNode(content.slice(lastIndex)));
    }
  }

  function getVisitorId() {
    const key = "dynamic-dan-visitor-id";
    let id = window.localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      window.localStorage.setItem(key, id);
    }
    return id;
  }

  function normalizeApiBase(apiBase) {
    if (!apiBase) {
      return "";
    }
    return apiBase.replace(/\/$/, "");
  }

  function inferBillMimeType(file) {
    const mimeType = String(file?.type || "").toLowerCase();
    if (BILL_UPLOAD_TYPES.has(mimeType)) {
      return mimeType;
    }

    const extension = String(file?.name || "")
      .split(".")
      .pop()
      .toLowerCase();
    return (
      {
        pdf: "application/pdf",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp"
      }[extension] || mimeType
    );
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const result = String(reader.result || "");
        const commaIndex = result.indexOf(",");
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      });
      reader.addEventListener("error", () => reject(new Error("Unable to read the file.")));
      reader.readAsDataURL(file);
    });
  }

  class DynamicDanWidget {
    constructor(options = {}) {
      this.options = {
        apiBase: normalizeApiBase(options.apiBase || ""),
        cssUrl: options.cssUrl || "",
        loadCss: options.loadCss !== false,
        target: options.target || "",
        floating: options.floating !== false,
        open: Boolean(options.open),
        teaser: options.teaser || "Speak with an agent!",
        logoUrl: options.logoUrl || DEFAULT_LOGO_URL
      };
      this.visitorId = getVisitorId();
      this.messages = [{ role: "assistant", content: DEFAULT_GREETING }];
      this.lastQuestion = "";
      this.isOpen = this.options.open || !this.options.floating;
      this.isTeaserDismissed = false;
      this.isExpanded = false;
    }

    mount() {
      if (this.options.loadCss) {
        ensureStylesheet(this.options.cssUrl);
      }

      this.root = createElement("div", "dd-root");
      if (!this.options.floating) {
        this.root.classList.add("dd-inline");
      }

      this.panel = createElement("section", "dd-panel");
      this.panel.setAttribute("aria-label", "Dynamic Dan chat");
      this.panel.innerHTML = [
        '<header class="dd-header">',
        '<div class="dd-avatar" aria-hidden="true"><img alt="" /></div>',
        '<div class="dd-heading"><div class="dd-title">Dynamic Dan</div><div class="dd-subtitle">Online</div></div>',
        '<div class="dd-header-actions">',
        '<button class="dd-expand" type="button" aria-label="Expand chat"></button>',
        '<button class="dd-collapse" type="button" aria-label="Close chat"></button>',
        "</div>",
        "</header>",
        '<div class="dd-conversation">',
        '<div class="dd-messages" role="log" aria-live="polite"></div>',
        '<div class="dd-quick-actions" aria-label="Suggested questions"></div>',
        "</div>",
        '<form class="dd-compose">',
        '<label class="dd-sr-only" for="dd-message-input">Message</label>',
        '<textarea id="dd-message-input" rows="1" maxlength="1000" placeholder="Write your message..." required></textarea>',
        '<div class="dd-compose-actions">',
        '<button class="dd-attach" type="button" aria-label="Upload energy bill"></button>',
        '<button class="dd-send" type="submit" aria-label="Send message"></button>',
        "</div>",
        '<input class="dd-file-input" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" />',
        "</form>",
        '<div class="dd-footer">Dynamic EcoHome AI Support</div>'
      ].join("");

      this.logoImg = this.panel.querySelector(".dd-avatar img");
      this.messagesEl = this.panel.querySelector(".dd-messages");
      this.quickActionsEl = this.panel.querySelector(".dd-quick-actions");
      this.form = this.panel.querySelector(".dd-compose");
      this.input = this.panel.querySelector("textarea");
      this.collapseButton = this.panel.querySelector(".dd-collapse");
      this.expandButton = this.panel.querySelector(".dd-expand");
      this.attachButton = this.panel.querySelector(".dd-attach");
      this.sendButton = this.panel.querySelector(".dd-send");
      this.fileInput = this.panel.querySelector(".dd-file-input");

      this.logoImg.src = this.options.logoUrl;
      this.logoImg.addEventListener("error", () => {
        this.logoImg.remove();
        this.panel.querySelector(".dd-avatar").textContent = "D";
      });
      this.expandButton.innerHTML = expandSvg();
      this.collapseButton.innerHTML = closeSvg();
      this.attachButton.innerHTML = attachmentSvg();
      this.sendButton.innerHTML = sendSvg();

      this.form.addEventListener("submit", (event) => {
        event.preventDefault();
        this.sendMessage(this.input.value);
      });

      this.collapseButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.close();
      });
      this.expandButton.addEventListener("click", () => this.toggleExpanded());
      this.attachButton.addEventListener("click", () => this.pickBillFile());
      this.fileInput.addEventListener("change", () => {
        const file = this.fileInput.files?.[0];
        this.fileInput.value = "";
        this.uploadEnergyBill(file);
      });
      this.input.addEventListener("input", () => {
        this.syncComposeState();
        if (this.input.value.trim()) {
          this.minimizeLeadForm();
        }
      });

      this.input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
          return;
        }

        event.preventDefault();
        this.form.requestSubmit();
      });

      this.renderQuickActions();
      this.renderMessages();
      this.syncComposeState();

      if (this.options.floating) {
        this.launcher = createElement("button", "dd-launcher");
        this.launcher.type = "button";
        this.launcher.title = "Open Dynamic Dan";
        this.launcher.setAttribute("aria-label", "Open Dynamic Dan");
        this.launcher.innerHTML = `${iconSvg()}<span class="dd-launcher-badge" aria-hidden="true">1</span>`;
        this.launcher.addEventListener("click", () => {
          this.dismissTeaser();
          this.toggle();
        });

        this.teaser = createElement("div", "dd-teaser");
        this.teaser.innerHTML = [
          '<button class="dd-teaser-copy" type="button"></button>'
        ].join("");
        this.teaser.querySelector(".dd-teaser-copy").textContent = this.options.teaser;
        this.teaser.querySelector(".dd-teaser-copy").addEventListener("click", () => {
          this.dismissTeaser();
          this.open();
        });

        this.root.append(this.teaser);
        this.root.append(this.launcher);
      }

      this.root.append(this.panel);
      this.syncOpenState();

      const target = this.options.target
        ? document.querySelector(this.options.target)
        : null;
      (target || document.body).append(this.root);
    }

    toggle() {
      this.isOpen = !this.isOpen;
      this.syncOpenState();
    }

    open() {
      this.isOpen = true;
      this.syncOpenState();
    }

    close() {
      if (!this.options.floating) {
        return;
      }

      this.isOpen = false;
      this.syncOpenState();
    }

    toggleExpanded() {
      this.isExpanded = !this.isExpanded;
      this.syncOpenState();
    }

    dismissTeaser() {
      this.isTeaserDismissed = true;
      this.root?.classList.add("dd-teaser-dismissed");
      if (this.teaser) {
        this.teaser.hidden = true;
        this.teaser.remove();
      }
    }

    syncOpenState() {
      this.root.classList.toggle("dd-open", this.isOpen);
      this.root.classList.toggle("dd-expanded", this.isExpanded);
      this.panel.hidden = !this.isOpen;
      this.panel.setAttribute("aria-hidden", String(!this.isOpen));
      this.panel.style.display = this.isOpen ? "flex" : "none";
      if (this.teaser) {
        this.teaser.hidden = this.isOpen || this.isTeaserDismissed;
      }
      if (this.launcher) {
        this.launcher.setAttribute("aria-expanded", String(this.isOpen));
      }
      if (this.expandButton) {
        this.expandButton.setAttribute("aria-pressed", String(this.isExpanded));
      }
      if (this.isOpen) {
        window.setTimeout(() => this.input?.focus(), 80);
      }
    }

    renderQuickActions() {
      const prompts = [
        { label: "Upload energy bill", upload: true },
        { label: "Do you offer solar?" },
        { label: "My AC is not working" },
        { label: "How much does HVAC cost?" },
        { label: "Contact support" }
      ];

      this.quickActionsEl.replaceChildren(
        ...prompts.map((prompt) => {
          const button = createElement(
            "button",
            `dd-chip${prompt.upload ? " dd-upload-chip" : ""}`,
            prompt.label
          );
          button.type = "button";
          button.addEventListener("click", () => {
            if (prompt.upload) {
              this.pickBillFile();
              return;
            }
            this.sendMessage(prompt.label);
          });
          return button;
        })
      );
    }

    renderMessages() {
      this.messagesEl.replaceChildren(
        ...this.messages.map((message) => {
          const row = createElement(
            "div",
            `dd-message dd-${message.role === "assistant" ? "agent" : "user"}-message`
          );
          const bubble = createElement("div", "dd-bubble");
          appendLinkedText(bubble, message.content);
          row.append(bubble);

          if (message.sources?.length) {
            const sources = createElement("div", "dd-sources");
            for (const source of message.sources) {
              const link = createElement("a", "", source.title || "Source");
              link.href = source.url;
              link.target = "_blank";
              link.rel = "noreferrer";
              sources.append(link);
            }
            row.append(sources);
          }

          return row;
        })
      );

      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    setLoading(isLoading) {
      this.form.classList.toggle("dd-loading", isLoading);
      this.input.disabled = isLoading;
      this.sendButton.disabled = isLoading;
      this.attachButton.disabled = isLoading;
      this.fileInput.disabled = isLoading;
      this.syncComposeState();
    }

    syncComposeState() {
      const hasText = Boolean(this.input?.value.trim());
      const isLoading = Boolean(this.input?.disabled);
      this.form?.classList.toggle("dd-has-text", hasText && !isLoading);
    }

    setLeadFormMinimized(form, isMinimized) {
      if (!form || form.classList.contains("dd-lead-confirmed")) {
        return;
      }

      form.classList.toggle("dd-lead-minimized", isMinimized);
      const tab = form.querySelector(".dd-lead-tab");
      const title = form.querySelector(".dd-lead-title");
      const toggle = form.querySelector(".dd-lead-toggle");
      tab?.setAttribute("aria-expanded", String(!isMinimized));
      if (title) {
        title.textContent = isMinimized ? "Contact details" : "Best contact details";
      }
      if (toggle) {
        toggle.textContent = isMinimized ? "+" : "-";
      }
    }

    toggleLeadForm(form) {
      this.setLeadFormMinimized(form, !form.classList.contains("dd-lead-minimized"));
    }

    minimizeLeadForm() {
      this.setLeadFormMinimized(this.panel?.querySelector(".dd-lead-form"), true);
    }

    pickBillFile() {
      this.fileInput.click();
    }

    showAssistantMessage(content) {
      this.messages.push({ role: "assistant", content });
      this.renderMessages();
    }

    async uploadEnergyBill(file) {
      if (!file) {
        return;
      }

      const mimeType = inferBillMimeType(file);
      if (!BILL_UPLOAD_TYPES.has(mimeType)) {
        this.showAssistantMessage("Please upload a PDF, PNG, JPG, or WebP image of your energy bill.");
        return;
      }

      if (file.size > MAX_BILL_UPLOAD_BYTES) {
        this.showAssistantMessage("Please upload a bill smaller than 8 MB.");
        return;
      }

      const fileName = file.name || "energy-bill";
      this.open();
      this.minimizeLeadForm();
      this.lastQuestion = `Uploaded energy bill: ${fileName}`;
      this.messages.push({ role: "user", content: `Uploaded energy bill: ${fileName}` });
      this.messages.push({ role: "assistant", content: "Reviewing your energy bill..." });
      this.renderMessages();
      this.setLoading(true);

      try {
        const fileData = await readFileAsBase64(file);
        const response = await fetch(`${this.options.apiBase}/api/analyze-bill`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName,
            mimeType,
            fileData,
            pageUrl: window.location.href,
            visitorId: this.visitorId
          })
        });
        const payload = await response.json().catch(() => ({}));

        this.messages.pop();
        this.messages.push({
          role: "assistant",
          content:
            payload.answer ||
            "I couldn't review that bill. Please try a clear PDF or image, or leave your details and a Dynamic EcoHome teammate can help.",
          sources: payload.sources || []
        });
        this.renderMessages();

        if (payload.action === "collect_lead") {
          this.renderLeadForm();
        }
      } catch {
        this.messages.pop();
        this.messages.push({
          role: "assistant",
          content:
            "I couldn't review that bill right now. You can still leave your details and a Dynamic EcoHome teammate can help with a free energy audit."
        });
        this.renderMessages();
        this.renderLeadForm();
      } finally {
        this.setLoading(false);
      }
    }

    async sendMessage(rawMessage) {
      const message = String(rawMessage || "").trim();
      if (!message) {
        return;
      }

      this.minimizeLeadForm();
      this.lastQuestion = message;
      this.input.value = "";
      this.syncComposeState();
      this.messages.push({ role: "user", content: message });
      this.messages.push({ role: "assistant", content: "Typing..." });
      this.renderMessages();
      this.setLoading(true);

      try {
        const response = await fetch(`${this.options.apiBase}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            pageUrl: window.location.href,
            visitorId: this.visitorId,
            conversation: this.messages
              .filter((item) => item.content !== "Typing...")
              .slice(-8)
          })
        });

        const payload = await response.json();
        this.messages.pop();
        this.messages.push({
          role: "assistant",
          content: payload.answer || "I had trouble answering that.",
          sources: payload.sources || []
        });

        this.renderMessages();

        if (payload.action === "collect_lead") {
          this.renderLeadForm();
        }
      } catch {
        this.messages.pop();
        this.messages.push({
          role: "assistant",
          content:
            "I'm having trouble connecting right now. You can reach Dynamic EcoHome at customersupport@dynamicecohome.com."
        });
        this.renderMessages();
      } finally {
        this.setLoading(false);
      }
    }

    renderLeadForm() {
      const existing = this.panel.querySelector(".dd-lead-form");
      if (existing) {
        existing.remove();
      }

      const form = createElement("form", "dd-lead-form");
      form.innerHTML = [
        '<button class="dd-lead-tab" type="button" aria-expanded="true">',
        '<span class="dd-lead-title">Best contact details</span>',
        '<span class="dd-lead-toggle" aria-hidden="true">-</span>',
        "</button>",
        '<div class="dd-lead-fields">',
        '<label>Name<input name="name" autocomplete="name" required /></label>',
        '<label>Phone<input name="phone" autocomplete="tel" required /></label>',
        '<label>Email<input name="email" autocomplete="email" /></label>',
        '<button class="dd-lead-submit" type="submit">Send</button>',
        "</div>"
      ].join("");

      form
        .querySelector(".dd-lead-tab")
        .addEventListener("click", () => this.toggleLeadForm(form));

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        form.querySelector(".dd-lead-submit").disabled = true;

        try {
          const response = await fetch(`${this.options.apiBase}/api/leads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...data,
              question: this.lastQuestion,
              pageUrl: window.location.href,
              visitorId: this.visitorId
            })
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.error || "Unable to save lead.");
          }

          form.replaceChildren(
            createElement(
              "div",
              "dd-lead-confirmation",
              payload.message || "Thanks. A Dynamic EcoHome teammate can follow up."
            )
          );
          form.classList.add("dd-lead-confirmed");
        } catch (error) {
          form.querySelector(".dd-lead-submit").disabled = false;
          let errorEl = form.querySelector(".dd-lead-error");
          if (!errorEl) {
            errorEl = createElement("div", "dd-lead-error");
            (form.querySelector(".dd-lead-fields") || form).append(errorEl);
          }
          errorEl.textContent = error.message;
        }
      });

      this.panel.insertBefore(form, this.form);
    }
  }

  window.DynamicDanWidget = {
    init(options) {
      const widget = new DynamicDanWidget(options);
      widget.mount();
      return widget;
    }
  };

  const scriptOptions = getScriptOptions();
  if (!scriptOptions.target && document.currentScript?.dataset.auto !== "false") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        window.DynamicDanWidget.init(scriptOptions);
      });
    } else {
      window.DynamicDanWidget.init(scriptOptions);
    }
  }
})();
