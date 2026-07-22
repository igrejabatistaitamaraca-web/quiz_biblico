if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

const fullscreenPages = new Set(["tv.html", "tv_quiz.html", "duelo.html"]);
if (fullscreenPages.has(location.pathname.split("/").pop())) {
  document.addEventListener("click", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  }, { once: true });
}
