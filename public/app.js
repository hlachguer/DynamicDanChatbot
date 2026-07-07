window.DynamicDanWidget.init({
  apiBase: "",
  floating: true,
  open: false,
  teaser: "Speak with an agent!"
});

fetch("/health")
  .then((response) => response.json())
  .then((health) => {
    const status = document.querySelector("#health-status");
    if (!status) return;
    status.textContent = health.openaiConfigured
      ? "Server online. OpenAI replies enabled."
      : "Server online. Local support fallback enabled.";
  })
  .catch(() => {
    const status = document.querySelector("#health-status");
    if (status) {
      status.textContent = "Server status unavailable.";
    }
  });
