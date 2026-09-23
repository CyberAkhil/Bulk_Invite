(function () {
  const stored = localStorage.getItem("theme");
  const theme = stored || "dark";
  document.documentElement.setAttribute("data-theme", theme);

  window.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    const setLabel = () => {
      const current = document.documentElement.getAttribute("data-theme");
      btn.textContent = current === "dark" ? "Light mode" : "Dark mode";
    };
    setLabel();
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      setLabel();
    });
  });
})();
