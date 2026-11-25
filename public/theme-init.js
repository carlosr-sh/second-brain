// Runs synchronously before first paint (external file: allowed by the CSP,
// unlike an inline script). Mirrors the theme preference cached by the SPA.
(function () {
  try {
    var pref = localStorage.getItem("sb.theme") || "system";
    var dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
