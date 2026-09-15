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
    tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">Loading…</td></tr>';
    supabaseClient
      .from("payments")
      .select("id, client_type, status, screenshot_path, submitted_at, confirmed_at, tc_agreed_at, amount, transaction_ref, rejection_reason, clients(id, name, phone, age, height_cm, weight_kg, diet)")
      .order("submitted_at", { ascending: false })
      .then(function (res) {
        if (res.error) {
          tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">Couldn\'t load data — refresh to retry.</td></tr>';
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
    if (currentFilter === "rejected") return r.status === "rejected";
    return true;
  }

  function matchesSearch(r) {
    if (!searchTerm) return true;
    var c = r.clients || {};
    var name = (c.name || "").toLowerCase();
    var phone = c.phone || "";
    return name.indexOf(searchTerm.toLowerCase()) !== -1 || phone.indexOf(searchTerm) !== -1;
  }

  function statusBadgeFor(r) {
    if (r.status === "confirmed") return '<span class="badge badge-confirmed">Confirmed</span>';
    if (r.status === "rejected") {
      var title = r.rejection_reason ? ' title="' + escapeHtml(r.rejection_reason) + '"' : "";
      return '<span class="badge badge-rejected"' + title + '>Rejected</span>';
    }
    return '<span class="badge badge-pending">Pending</span>';
  }

  function actionButtonsFor(r) {
    if (r.status === "submitted") {
      return (
        '<button class="row-btn confirm-btn" data-id="' + r.id + '">Mark confirmed</button>' +
        '<button class="row-btn reject-btn" data-id="' + r.id + '">Reject</button>'
      );
    }
    if (r.status === "confirmed") {
      return '<button class="row-btn undo-btn" data-id="' + r.id + '">Undo</button>';
    }
    if (r.status === "rejected") {
      return '<button class="row-btn undo-btn" data-id="' + r.id + '">Restore</button>';
    }
    return "";
  }

  function renderTable() {
    var tbody = document.getElementById("paymentsBody");
    var rows = allRows.filter(matchesFilter).filter(matchesSearch);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">No matching records.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (r) {
      var c = r.clients || {};
      var details = [c.age ? c.age + " yrs" : null, c.height_cm ? c.height_cm + " cm" : null, c.weight_kg ? c.weight_kg + " kg" : null, c.diet]
        .filter(Boolean).join(" · ") || "—";
      return (
        "<tr>" +
          "<td>" + formatDate(r.submitted_at) + "</td>" +
          '<td><div class="cell-name">' + escapeHtml(c.name || "—") + '</div><div class="cell-sub">' + escapeHtml(c.phone || "") + "</div></td>" +
          '<td><span class="badge badge-type">' + escapeHtml(r.client_type) + "</span></td>" +
          '<td class="cell-sub">' + escapeHtml(details) + "</td>" +
          "<td>" + (r.amount != null ? "₹" + escapeHtml(r.amount) : "—") + "</td>" +
          '<td class="cell-sub">' + escapeHtml(r.transaction_ref || "—") + "</td>" +
          '<td><button class="row-btn view-btn" data-path="' + escapeHtml(r.screenshot_path) + '">View</button></td>' +
          "<td>" + statusBadgeFor(r) + actionButtonsFor(r) + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  function viewProof(btn) {
    var path = btn.dataset.path;
    btn.disabled = true;
    btn.textContent = "…";
    supabaseClient.storage.from("payment-proofs").createSignedUrl(path, 120).then(function (res) {
      btn.disabled = false;
      btn.textContent = "View";
      if (res.error || !res.data) {
        alert("Could not load screenshot.");
        return;
      }
      window.open(res.data.signedUrl, "_blank", "noopener");
    });
  }

  function setPaymentStatus(id, fields) {
    return supabaseClient.from("payments").update(fields).eq("id", id);
  }

  document.getElementById("paymentsBody").addEventListener("click", function (e) {
    var viewBtn = e.target.closest(".view-btn");
    if (viewBtn) {
      viewProof(viewBtn);
      return;
    }

    var confirmBtn = e.target.closest(".confirm-btn");
    if (confirmBtn) {
      var id = confirmBtn.dataset.id;
      confirmBtn.disabled = true;
      confirmBtn.textContent = "…";
      setPaymentStatus(id, { status: "confirmed", confirmed_at: new Date().toISOString() }).then(function (res) {
        if (res.error) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = "Mark confirmed";
          alert("Could not update. Try again.");
          return;
        }
        loadPayments();
      });
      return;
    }

    var rejectBtn = e.target.closest(".reject-btn");
    if (rejectBtn) {
      var reason = prompt("Reason for rejecting this payment (shown only in the admin view):", "");
      if (reason === null) return;
      var rid = rejectBtn.dataset.id;
      rejectBtn.disabled = true;
      rejectBtn.textContent = "…";
      setPaymentStatus(rid, { status: "rejected", rejection_reason: reason.trim() || null, confirmed_at: null }).then(function (res) {
        if (res.error) {
          rejectBtn.disabled = false;
          rejectBtn.textContent = "Reject";
          alert("Could not update. Try again.");
          return;
        }
        loadPayments();
      });
      return;
    }

    var undoBtn = e.target.closest(".undo-btn");
    if (undoBtn) {
      var uid = undoBtn.dataset.id;
      undoBtn.disabled = true;
      undoBtn.textContent = "…";
      setPaymentStatus(uid, { status: "submitted", confirmed_at: null, rejection_reason: null }).then(function (res) {
        if (res.error) {
          undoBtn.disabled = false;
          undoBtn.textContent = "Undo";
          alert("Could not update. Try again.");
          return;
        }
        loadPayments();
      });
    }
  });

  /* ---------------- CSV export ---------------- */

  function csvField(v) {
    var s = v == null ? "" : String(v);
    return '"' + s.replace(/"/g, '""') + '"';
  }

  document.getElementById("exportCsvBtn").addEventListener("click", function () {
    var header = ["Submitted", "Client", "Phone", "Type", "Amount", "Transaction Ref", "Status", "Confirmed At", "Rejection Reason"];
    var lines = [header.map(csvField).join(",")];
    allRows.forEach(function (r) {
      var c = r.clients || {};
      lines.push([
        r.submitted_at, c.name, c.phone, r.client_type, r.amount, r.transaction_ref,
        r.status, r.confirmed_at, r.rejection_reason
      ].map(csvField).join(","));
    });
    var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "ravi-fitness-payments-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          id: c.id, name: c.name, phone: c.phone, age: c.age, height_cm: c.height_cm, weight_kg: c.weight_kg, diet: c.diet,
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

  function getClientPayments(clientId) {
    return allRows
      .filter(function (r) { return r.clients && r.clients.id === clientId; })
      .sort(function (a, b) { return new Date(b.submitted_at) - new Date(a.submitted_at); });
  }

  function renderClientHistory(clientId) {
    var payments = getClientPayments(clientId);
    var rows = payments.map(function (r) {
      var statusBadge = r.status === "confirmed"
        ? '<span class="badge badge-confirmed">Confirmed</span>'
        : '<span class="badge badge-pending">Pending</span>';
      return (
        "<tr>" +
          "<td>" + formatDate(r.submitted_at) + "</td>" +
          '<td><span class="badge badge-type">' + escapeHtml(r.client_type) + "</span></td>" +
          "<td>" + statusBadge + "</td>" +
          '<td><button class="row-btn view-btn" data-path="' + escapeHtml(r.screenshot_path) + '">View</button></td>' +
        "</tr>"
      );
    }).join("");
    return (
      '<table class="payments-table history-table"><thead><tr>' +
        "<th>Submitted</th><th>Type</th><th>Status</th><th>Proof</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table>"
    );
  }

  function renderClients() {
    var tbody = document.getElementById("clientsBody");
    var list = computeClients();
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">No clients yet.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (c) {
      var id = escapeHtml(c.id);
      return (
        '<tr class="client-row" data-client-id="' + id + '">' +
          '<td><button class="expand-btn" type="button" aria-expanded="false">&#9656;</button>' +
            '<div class="cell-name">' + escapeHtml(c.name || "—") + '</div><div class="cell-sub">' + escapeHtml(c.phone || "") + "</div></td>" +
          "<td>" + (c.age != null ? escapeHtml(c.age) + " yrs" : "—") + "</td>" +
          "<td>" + (c.height_cm != null ? escapeHtml(c.height_cm) + " cm" : "—") + "</td>" +
          "<td>" + (c.weight_kg != null ? escapeHtml(c.weight_kg) + " kg" : "—") + "</td>" +
          "<td>" + escapeHtml(c.diet || "—") + "</td>" +
          "<td>" + c.paymentCount + "</td>" +
          "<td>" + (c.tcAgreedAt ? formatDate(c.tcAgreedAt) : "—") +
            '<button class="row-btn edit-client-btn" type="button" data-id="' + id + '" data-name="' + escapeHtml(c.name || "") + '" data-phone="' + escapeHtml(c.phone || "") + '">Edit</button>' +
          "</td>" +
        "</tr>" +
        '<tr class="client-history-row" data-client-id="' + id + '" hidden>' +
          '<td colspan="7">' + renderClientHistory(c.id) + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  document.getElementById("clientsBody").addEventListener("click", function (e) {
    var viewBtn = e.target.closest(".view-btn");
    if (viewBtn) {
      viewProof(viewBtn);
      return;
    }

    var editBtn = e.target.closest(".edit-client-btn");
    if (editBtn) {
      var newName = prompt("Client name:", editBtn.dataset.name || "");
      if (newName === null) return;
      newName = newName.trim();
      if (newName.length < 2) { alert("Name must be at least 2 letters."); return; }
      var newPhone = prompt("Phone number (10 digits, starting 6-9):", editBtn.dataset.phone || "");
      if (newPhone === null) return;
      newPhone = newPhone.trim();
      if (!/^[6-9]\d{9}$/.test(newPhone)) { alert("That doesn't look like a valid 10-digit phone number."); return; }
      editBtn.disabled = true;
      editBtn.textContent = "…";
      supabaseClient.from("clients").update({ name: newName, phone: newPhone }).eq("id", editBtn.dataset.id).then(function (res) {
        if (res.error) {
          editBtn.disabled = false;
          editBtn.textContent = "Edit";
          alert(res.error.message && res.error.message.indexOf("duplicate") !== -1
            ? "Another client already has that phone number."
            : "Could not update. Try again.");
          return;
        }
        loadPayments();
      });
      return;
    }

    var row = e.target.closest(".client-row");
    if (!row) return;
    var id = row.dataset.clientId;
    var historyRow = tableRowFor(id);
    if (!historyRow) return;
    var wasHidden = historyRow.hidden;
    historyRow.hidden = !wasHidden;
    var btn = row.querySelector(".expand-btn");
    if (btn) {
      btn.setAttribute("aria-expanded", String(wasHidden));
      btn.innerHTML = wasHidden ? "&#9662;" : "&#9656;";
    }
  });

  function tableRowFor(clientId) {
    var rows = document.querySelectorAll(".client-history-row");
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].dataset.clientId === clientId) return rows[i];
    }
    return null;
  }

  /* ---------------- Renewals view ---------------- */

  var CYCLE_DAYS = 28;
  var MS_PER_DAY = 24 * 60 * 60 * 1000;

  function computeRenewals() {
    // Based on the last CONFIRMED payment, not merely submitted — a screenshot
    // sitting in "pending" hasn't actually been verified yet, so it shouldn't
    // reset anyone's cycle. Clients with no confirmed payment yet are left out
    // here (see the "awaiting" count used by the empty state below).
    var byClient = {};
    allRows.forEach(function (r) {
      if (r.status !== "confirmed" || !r.confirmed_at) return;
      var c = r.clients;
      if (!c) return;
      var existing = byClient[c.id];
      if (!existing || new Date(r.confirmed_at) > new Date(existing.confirmed_at)) {
        byClient[c.id] = { name: c.name, phone: c.phone, confirmed_at: r.confirmed_at };
      }
    });
    var now = new Date();
    var list = Object.keys(byClient).map(function (id) {
      var entry = byClient[id];
      var lastDate = new Date(entry.confirmed_at);
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
      var msg = allRows.length
        ? "No confirmed payments yet — renewals appear here once you confirm one."
        : "No clients yet.";
      tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">' + msg + '</td></tr>';
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
