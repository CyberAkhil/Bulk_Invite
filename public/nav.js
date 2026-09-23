// Injects the top nav bar into #navHost, marking the current page active.
(function () {
  const pages = [
    { href: "connect.html", label: "Connect" },
    { href: "upload.html", label: "Upload" },
    { href: "send.html", label: "Send" },
    { href: "status.html", label: "Status" },
  ];
  const current = location.pathname.split("/").pop() || "connect.html";

  const links = pages
    .map(
      (p) =>
        `<a href="${p.href}" class="${p.href === current ? "active" : ""}">${p.label}</a>`
    )
    .join("");

  document.write(`
    <nav class="topnav">
      <div class="topnav-inner">
        <a href="connect.html" class="brand">Bulk<span>Invite</span></a>
        <div class="nav-links">${links}<a href="#" id="logoutLink">Logout</a></div>
        <button class="theme-toggle" id="themeToggle">Light mode</button>
      </div>
    </nav>
  `);
})();
