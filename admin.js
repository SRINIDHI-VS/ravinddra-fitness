(function () {
  "use strict";

  var supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  var loginScreen = document.getElementById("loginScreen");
  var dashboard = document.getElementById("dashboard");
  var loginForm = document.getElementById("loginForm");
  var loginError = document.getElementById("loginError");
  var loginBtn = document.getElementById("loginBtn");
  var signOutBtn = document.getElementById("signOutBtn");

  var allRows = [];
  var currentFilter = "all";
  var searchTerm = "";

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }

  /* ---------------- Auth ---------------- */

  function showLogin() {
    loginScreen.hidden = false;
    dashboard.hidden = true;
  }

  function showDashboard() {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    loadPayments();
  }

  supabaseClient.auth.getSession().then(function (res) {
    if (res.data && res.data.session) showDashboard(); else showLogin();
  });

  supabaseClient.auth.onAuthStateChange(function (_event, session) {
    if (session) showDashboard(); else showLogin();
  });

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginError.classList.remove("show");
    var email = document.getElementById("loginEmail").value.trim();
    var password = document.getElementById("loginPassword").value;
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in…";
    supabaseClient.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      loginBtn.disabled = false;
      loginBtn.textContent = "Sign in";
      if (res.error) {
        loginError.textContent = "Wrong email or password.";
        loginError.classList.add("show");
      }
    });
  });

  signOutBtn.addEventListener("click", function () {
    supabaseClient.auth.signOut();
  });

  /* ---------------- Data ---------------- */

  function loadPayments() {
    var tbody = document.getElementById("paymentsBody");
    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">Loading…</td></tr>';
    supabaseClient
      .from("payments")
      .select("id, client_type, status, screenshot_path, submitted_at, confirmed_at, tc_agreed_at, clients(id, name, phone, age, height_cm, weight_kg, diet)")
      .order("submitted_at", { ascending: false })
      .then(function (res) {
        if (res.error) {
          tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">Couldn\'t load data — refresh to retry.</td></tr>';
          console.error(res.error);
          return;
        }
        allRows = res.data || [];
        renderStats();
        renderTable();
        renderClients();
        renderRenewals();
      });
  }

  function renderStats() {
    var uniqueClients = {};
    var now = new Date();
    var thisMonthCount = 0;
    var pendingCount = 0;
    allRows.forEach(function (r) {
      if (r.clients) uniqueClients[r.clients.id] = true;
      var d = new Date(r.submitted_at);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) thisMonthCount++;
      if (r.status === "submitted") pendingCount++;
    });
    document.getElementById("statClients").textContent = Object.keys(uniqueClients).length;
    document.getElementById("statMonth").textContent = thisMonthCount;
    document.getElementById("statPending").textContent = pendingCount;
  }

  function matchesFilter(r) {
    if (currentFilter === "pending") return r.status === "submitted";
    if (currentFilter === "confirmed") return r.status === "confirmed";
    return true;
  }

  function matchesSearch(r) {
    if (!searchTerm) return true;
    var c = r.clients || {};
    var name = (c.name || "").toLowerCase();
    var phone = c.phone || "";
    return name.indexOf(searchTerm.toLowerCase()) !== -1 || phone.indexOf(searchTerm) !== -1;
  }

  function renderTable() {
    var tbody = document.getElementById("paymentsBody");
    var rows = allRows.filter(matchesFilter).filter(matchesSearch);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">No matching records.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (r) {
      var c = r.clients || {};
      var details = [c.age ? c.age + " yrs" : null, c.height_cm ? c.height_cm + " cm" : null, c.weight_kg ? c.weight_kg + " kg" : null, c.diet]
        .filter(Boolean).join(" · ") || "—";
      var statusBadge = r.status === "confirmed"
        ? '<span class="badge badge-confirmed">Confirmed</span>'
        : '<span class="badge badge-pending">Pending</span>';
      var actionBtn = r.status === "submitted"
        ? '<button class="row-btn confirm-btn" data-id="' + r.id + '">Mark confirmed</button>'
        : "";
      return (
        "<tr>" +
          "<td>" + formatDate(r.submitted_at) + "</td>" +
          '<td><div class="cell-name">' + escapeHtml(c.name || "—") + '</div><div class="cell-sub">' + escapeHtml(c.phone || "") + "</div></td>" +
          '<td><span class="badge badge-type">' + escapeHtml(r.client_type) + "</span></td>" +
          '<td class="cell-sub">' + escapeHtml(details) + "</td>" +
          '<td><button class="row-btn view-btn" data-path="' + escapeHtml(r.screenshot_path) + '">View</button></td>' +
          "<td>" + statusBadge + actionBtn + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  document.getElementById("paymentsBody").addEventListener("click", function (e) {
    var viewBtn = e.target.closest(".view-btn");
    if (viewBtn) {
      var path = viewBtn.dataset.path;
      viewBtn.disabled = true;
      viewBtn.textContent = "…";
      supabaseClient.storage.from("payment-proofs").createSignedUrl(path, 120).then(function (res) {
        viewBtn.disabled = false;
        viewBtn.textContent = "View";
        if (res.error || !res.data) {
          alert("Could not load screenshot.");
          return;
        }
        window.open(res.data.signedUrl, "_blank", "noopener");
      });
      return;
    }

    var confirmBtn = e.target.closest(".confirm-btn");
    if (confirmBtn) {
      var id = confirmBtn.dataset.id;
      confirmBtn.disabled = true;
      confirmBtn.textContent = "…";
      supabaseClient
        .from("payments")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", id)
        .then(function (res) {
          if (res.error) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Mark confirmed";
            alert("Could not update. Try again.");
            return;
          }
          loadPayments();
        });
    }
  });

  document.querySelectorAll(".filter-tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".filter-tab").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderTable();
    });
  });

  document.getElementById("searchInput").addEventListener("input", function () {
    searchTerm = this.value.trim();
    renderTable();
  });

  /* ---------------- Clients view ---------------- */

  function computeClients() {
    var byClient = {};
    allRows.forEach(function (r) {
      var c = r.clients;
      if (!c) return;
      if (!byClient[c.id]) {
        byClient[c.id] = {
          name: c.name, phone: c.phone, age: c.age, height_cm: c.height_cm, weight_kg: c.weight_kg, diet: c.diet,
          paymentCount: 0, tcAgreedAt: null
        };
      }
      var entry = byClient[c.id];
      entry.paymentCount++;
      if (r.tc_agreed_at && (!entry.tcAgreedAt || new Date(r.tc_agreed_at) > new Date(entry.tcAgreedAt))) {
        entry.tcAgreedAt = r.tc_agreed_at;
      }
    });
    var list = Object.keys(byClient).map(function (id) { return byClient[id]; });
    list.sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
    return list;
  }

  function renderClients() {
    var tbody = document.getElementById("clientsBody");
    var list = computeClients();
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">No clients yet.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (c) {
      return (
        "<tr>" +
          '<td><div class="cell-name">' + escapeHtml(c.name || "—") + '</div><div class="cell-sub">' + escapeHtml(c.phone || "") + "</div></td>" +
          "<td>" + (c.age != null ? escapeHtml(c.age) + " yrs" : "—") + "</td>" +
          "<td>" + (c.height_cm != null ? escapeHtml(c.height_cm) + " cm" : "—") + "</td>" +
          "<td>" + (c.weight_kg != null ? escapeHtml(c.weight_kg) + " kg" : "—") + "</td>" +
          "<td>" + escapeHtml(c.diet || "—") + "</td>" +
          "<td>" + c.paymentCount + "</td>" +
          "<td>" + (c.tcAgreedAt ? formatDate(c.tcAgreedAt) : "—") + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  /* ---------------- Renewals view ---------------- */

  var CYCLE_DAYS = 28;
  var MS_PER_DAY = 24 * 60 * 60 * 1000;

  function computeRenewals() {
    var byClient = {};
    allRows.forEach(function (r) {
      var c = r.clients;
      if (!c) return;
      var existing = byClient[c.id];
      if (!existing || new Date(r.submitted_at) > new Date(existing.submitted_at)) {
        byClient[c.id] = { name: c.name, phone: c.phone, submitted_at: r.submitted_at };
      }
    });
    var now = new Date();
    var list = Object.keys(byClient).map(function (id) {
      var entry = byClient[id];
      var lastDate = new Date(entry.submitted_at);
      var nextDue = new Date(lastDate.getTime() + CYCLE_DAYS * MS_PER_DAY);
      var daysUntil = Math.ceil((nextDue - now) / MS_PER_DAY);
      var status = daysUntil < 0 ? "overdue" : (daysUntil <= 3 ? "soon" : "ok");
      return { name: entry.name, phone: entry.phone, lastDate: lastDate, nextDue: nextDue, daysUntil: daysUntil, status: status };
    });
    list.sort(function (a, b) { return a.nextDue - b.nextDue; });
    return list;
  }

  function statusLabel(row) {
    if (row.status === "overdue") return "Overdue by " + Math.abs(row.daysUntil) + (Math.abs(row.daysUntil) === 1 ? " day" : " days");
    if (row.daysUntil === 0) return "Due today";
    if (row.status === "soon") return "Due in " + row.daysUntil + (row.daysUntil === 1 ? " day" : " days");
    return "Due in " + row.daysUntil + " days";
  }

  function renderRenewals() {
    var tbody = document.getElementById("renewalsBody");
    var rows = computeRenewals();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">No clients yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (r) {
      var badgeClass = r.status === "overdue" ? "badge-overdue" : (r.status === "soon" ? "badge-soon" : "badge-ok");
      return (
        "<tr>" +
          '<td><div class="cell-name">' + escapeHtml(r.name) + '</div><div class="cell-sub">' + escapeHtml(r.phone) + "</div></td>" +
          "<td>" + formatDate(r.lastDate.toISOString()) + "</td>" +
          "<td>" + formatDate(r.nextDue.toISOString()) + "</td>" +
          '<td><span class="badge ' + badgeClass + '">' + statusLabel(r) + "</span></td>" +
        "</tr>"
      );
    }).join("");
  }

  document.querySelectorAll(".view-tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".view-tab").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var view = btn.dataset.view;
      document.getElementById("paymentsView").hidden = view !== "payments";
      document.getElementById("clientsView").hidden = view !== "clients";
      document.getElementById("renewalsView").hidden = view !== "renewals";
      if (view === "clients") renderClients();
      if (view === "renewals") renderRenewals();
    });
  });
})();
