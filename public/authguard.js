// Include on every protected page, after nav.js.
// Redirects to login.html if the session isn't valid, wires the Logout
// link that nav.js injects, and adds an "Admin" nav link for the admin user.
(function () {
  const readyPromise = fetch("/api/auth/me").then(async (res) => {
    if (!res.ok) {
      location.href = "login.html";
      return null;
    }
    return res.json();
  });

  window.addEventListener("DOMContentLoaded", async () => {
    const data = await readyPromise;
    if (!data) return;

    const logoutLink = document.getElementById("logoutLink");
    if (logoutLink) {
      logoutLink.addEventListener("click", async (e) => {
        e.preventDefault();
        await fetch("/api/auth/logout", { method: "POST" });
        location.href = "login.html";
      });
    }

    if (data.isAdmin) {
      const navLinks = document.querySelector(".nav-links");
      if (navLinks && !document.getElementById("adminNavLink")) {
        const adminLink = document.createElement("a");
        adminLink.id = "adminNavLink";
        adminLink.href = "admin.html";
        adminLink.textContent = "Admin";
        navLinks.insertBefore(adminLink, logoutLink);
      }
    }
  });
})();
