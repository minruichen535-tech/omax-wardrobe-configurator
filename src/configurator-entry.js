const segments = window.location.pathname.split("/").filter(Boolean);
const isConfiguratorIndex = segments.length === 1 && segments[0] === "configurator";

if (isConfiguratorIndex) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/src/dashboard/dashboard.css?v=cache-20260617-01";
  document.head.appendChild(stylesheet);
  import("./dashboard/dashboard-main.js?v=cache-20260617-01");
} else {
  import("./main.js?v=cache-20260617-01");
}
