(function () {
  "use strict";

  // persistSession: false is deliberate — this is the PUBLIC enrollment form.
  // Supabase Auth sessions are saved to localStorage per project, shared across
  // every page on this domain. If Ravi (or anyone) is logged into /admin.html
  // in the same browser, a default client here would silently pick up his
  // admin session and upload as him instead of as an anonymous visitor —
  // which fails, because only the "anon" role is allowed to upload proofs,
  // not "authenticated". Forcing a clean, session-less client keeps this form
  // always anonymous, regardless of what else is logged in on this browser.
  var supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  var PATHS = {
    New: { steps: ["details", "terms", "payment", "proof"], labels: ["Details", "Terms", "Payment", "Proof"] },
    Existing: { steps: ["identify", "payment", "proof"], labels: ["You", "Payment", "Proof"] }
  };

  var stepEls = {};
  Array.prototype.slice.call(document.querySelectorAll(".step")).forEach(function (el) {
    stepEls[el.dataset.step] = el;
  });

  var railEl = document.getElementById("rail");
  var railLabelsEl = document.getElementById("railLabels");

  var clientType = null;
  var path = null;
  var posInPath = 0;

  function buildRail() {
    railEl.innerHTML = "";
    railLabelsEl.innerHTML = "";
    path.labels.forEach(function (label, i) {
      var seg = document.createElement("div");
      seg.className = "rail-seg";
      seg.dataset.i = i;
      railEl.appendChild(seg);

      var span = document.createElement("span");
      span.dataset.i = i;
      span.textContent = label;
      railLabelsEl.appendChild(span);
    });
    railEl.style.display = "";
    railLabelsEl.style.display = "";
  }

  function updateRail() {
    Array.prototype.slice.call(railEl.children).forEach(function (seg, i) {
      seg.classList.toggle("done", i < posInPath);
      seg.classList.toggle("active", i === posInPath);
    });
    Array.prototype.slice.call(railLabelsEl.children).forEach(function (lab, i) {
      lab.classList.toggle("current", i === posInPath);
    });
  }

  function showStepKey(key, animate) {
    Object.keys(stepEls).forEach(function (k) {
      var el = stepEls[k];
      var active = k === key;
      el.classList.toggle("active", active);
      if (active && animate) {
        el.classList.remove("slide-in");
        void el.offsetWidth;
        el.classList.add("slide-in");
      }
    });
    if (key !== "choice" && key !== "done" && path) {
      var eyebrow = stepEls[key].querySelector(".step-eyebrow");
      if (eyebrow) eyebrow.textContent = "Step " + (posInPath + 1) + " of " + path.steps.length;
      updateRail();
    }
    if (key === "choice" || key === "done") {
      railEl.style.display = "none";
      railLabelsEl.style.display = "none";
    }
  }

  function goToPos(i, animate) {
    posInPath = i;
    showStepKey(path.steps[i], animate);
  }

  /* ---------------- Choice ---------------- */

  document.querySelectorAll(".choice-card").forEach(function (btn) {
    btn.addEventListener("click", function () {
      clientType = btn.dataset.type;
      document.getElementById("clientTypeField").value = clientType;
      path = PATHS[clientType];
      buildRail();
      goToPos(0, true);
    });
  });

  /* ---------------- Validation ---------------- */

  var validators = {
    text: function (v) { return /^[A-Za-z][A-Za-z .]{1,}$/.test((v || "").trim()); },
    phone: function (v) { return /^[6-9]\d{9}$/.test((v || "").trim()); },
    range: function (v, min, max) {
      if (v === "" || v === null || v === undefined) return false;
      var n = Number(v);
      return Number.isFinite(n) && n >= min && n <= max;
    }
  };

  function bindLiveValidation(inputId, wrapperId, validateFn) {
    var el = document.getElementById(inputId);
    var touched = false;
    function run(showIfInvalid) {
      var ok = validateFn(el.value);
      var wrapper = document.getElementById(wrapperId);
      if (showIfInvalid) wrapper.classList.toggle("error", !ok);
      else if (ok) wrapper.classList.remove("error");
      return ok;
    }
    el.addEventListener("blur", function () { touched = true; run(true); });
    el.addEventListener("input", function () { if (touched) run(true); });
    return function (showIfInvalid) { return run(showIfInvalid); };
  }

  var checkName = bindLiveValidation("clientName", "fieldName", validators.text);
  var checkPhone = bindLiveValidation("clientPhone", "fieldPhone", validators.phone);
  var checkAge = bindLiveValidation("clientAge", "fieldAge", function (v) { return validators.range(v, 10, 90); });
  var checkHeight = bindLiveValidation("clientHeight", "fieldHeight", function (v) { return validators.range(v, 100, 230); });
  var checkWeight = bindLiveValidation("clientWeight", "fieldWeight", function (v) { return validators.range(v, 25, 250); });

  var checkNameEx = bindLiveValidation("clientNameEx", "fieldNameEx", validators.text);
  var checkPhoneEx = bindLiveValidation("clientPhoneEx", "fieldPhoneEx", validators.phone);

  var selectedDiet = "";
  function validateDiet(showIfInvalid) {
    var ok = !!selectedDiet;
    if (showIfInvalid) {
      document.getElementById("fieldDiet").classList.toggle("error", !ok);
      document.getElementById("dietPills").classList.toggle("error", !ok);
    }
    return ok;
  }

  document.querySelectorAll("#dietPills .pill").forEach(function (p) {
    p.addEventListener("click", function () {
      document.querySelectorAll("#dietPills .pill").forEach(function (o) { o.classList.remove("selected"); });
      p.classList.add("selected");
      selectedDiet = p.dataset.val;
      validateDiet(true);
    });
  });

  function focusFirstInvalid(ids) {
    for (var i = 0; i < ids.length; i++) {
      var wrapper = document.getElementById(ids[i]);
      if (wrapper && wrapper.classList.contains("error")) {
        wrapper.scrollIntoView({ block: "center", behavior: "smooth" });
        var input = wrapper.querySelector("input");
        if (input) input.focus();
        return;
      }
    }
  }

  function validateDetailsStep() {
    var nameOk = checkName(true);
    var phoneOk = checkPhone(true);
    var ageOk = checkAge(true);
    var heightOk = checkHeight(true);
    var weightOk = checkWeight(true);
    var dietOk = validateDiet(true);
    var allOk = nameOk && phoneOk && ageOk && heightOk && weightOk && dietOk;
    if (!allOk) focusFirstInvalid(["fieldName", "fieldPhone", "fieldAge", "fieldHeight", "fieldWeight", "fieldDiet"]);
    else {
      document.getElementById("clientNameHidden").value = document.getElementById("clientName").value.trim();
      document.getElementById("clientPhoneHidden").value = document.getElementById("clientPhone").value.trim();
      document.getElementById("clientAgeHidden").value = document.getElementById("clientAge").value;
      document.getElementById("clientHeightHidden").value = document.getElementById("clientHeight").value;
      document.getElementById("clientWeightHidden").value = document.getElementById("clientWeight").value;
      document.getElementById("dietHidden").value = selectedDiet;
    }
    return allOk;
  }

  function validateIdentifyStep() {
    var nameOk = checkNameEx(true);
    var phoneOk = checkPhoneEx(true);
    var allOk = nameOk && phoneOk;
    if (!allOk) focusFirstInvalid(["fieldNameEx", "fieldPhoneEx"]);
    else {
      document.getElementById("clientNameHidden").value = document.getElementById("clientNameEx").value.trim();
      document.getElementById("clientPhoneHidden").value = document.getElementById("clientPhoneEx").value.trim();
      document.getElementById("clientAgeHidden").value = "";
      document.getElementById("clientHeightHidden").value = "";
      document.getElementById("clientWeightHidden").value = "";
      document.getElementById("dietHidden").value = "";
    }
    return allOk;
  }

  function validateCurrentStep() {
    var key = path.steps[posInPath];
    if (key === "details") return validateDetailsStep();
    if (key === "identify") return validateIdentifyStep();
    return true;
  }

  document.querySelectorAll("[data-next]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!validateCurrentStep()) return;
      goToPos(posInPath + 1, true);
    });
  });
  document.querySelectorAll("[data-back]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (posInPath === 0) {
        path = null;
        showStepKey("choice", true);
      } else {
        goToPos(posInPath - 1, true);
      }
    });
  });

  /* ---------------- Terms scroll-to-unlock ---------------- */

  var tcBox = document.getElementById("tcBox");
  var agreeBox = document.getElementById("agreeBox");
  var agreeRow = document.getElementById("agreeRow");
  var scrollHint = document.getElementById("scrollHint");
  var toPayment = document.getElementById("toPayment");

  function checkScrolled() {
    if (tcBox.scrollTop + tcBox.clientHeight >= tcBox.scrollHeight - 8) {
      agreeBox.disabled = false;
      agreeRow.classList.add("unlocked");
      scrollHint.style.display = "none";
    }
  }
  tcBox.addEventListener("scroll", checkScrolled);
  window.addEventListener("load", function () {
    if (tcBox.scrollHeight <= tcBox.clientHeight + 4) checkScrolled();
  });

  agreeBox.addEventListener("change", function () {
    toPayment.disabled = !agreeBox.checked;
    if (agreeBox.checked) {
      document.getElementById("tcTimestamp").value = new Date().toISOString();
    }
  });

  /* ---------------- UPI copy ---------------- */

  document.getElementById("copyUpi").addEventListener("click", function () {
    var btn = this;
    navigator.clipboard.writeText("9902269943@ybl").then(function () {
      btn.textContent = "Copied ✓";
      btn.classList.add("copied");
      setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1800);
    });
  });

  /* ---------------- File upload + validation ---------------- */

  var MAX_FILE_BYTES = 5 * 1024 * 1024;
  var ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

  var proofFile = document.getElementById("proofFile");
  var previewImg = document.getElementById("previewImg");
  var uploadPrompt = document.getElementById("uploadPrompt");
  var uploadBox = document.getElementById("uploadBox");
  var fileError = document.getElementById("fileError");
  var submitBtn = document.getElementById("submitBtn");
  var summaryBox = document.getElementById("summaryBox");
  var submitError = document.getElementById("submitError");

  proofFile.addEventListener("change", function () {
    var file = proofFile.files && proofFile.files[0];
    if (!file) return;

    var validType = ACCEPTED_TYPES.indexOf(file.type) !== -1;
    var validSize = file.size <= MAX_FILE_BYTES;

    if (!validType || !validSize) {
      fileError.classList.add("show");
      uploadBox.classList.add("error");
      previewImg.style.display = "none";
      uploadPrompt.style.display = "block";
      submitBtn.disabled = true;
      proofFile.value = "";
      return;
    }

    fileError.classList.remove("show");
    uploadBox.classList.remove("error");
    var url = URL.createObjectURL(file);
    previewImg.src = url;
    previewImg.style.display = "block";
    uploadPrompt.style.display = "none";
    submitBtn.disabled = false;
    renderSummary();
  });

  function renderSummary() {
    var rows = [["Name", document.getElementById("clientNameHidden").value], ["Phone", document.getElementById("clientPhoneHidden").value]];
    if (clientType === "New") {
      rows.push(
        ["Age", document.getElementById("clientAgeHidden").value],
        ["Height", document.getElementById("clientHeightHidden").value + " cm"],
        ["Weight", document.getElementById("clientWeightHidden").value + " kg"],
        ["Diet", document.getElementById("dietHidden").value]
      );
    }
    summaryBox.innerHTML = rows.map(function (r) {
      return '<div class="summary-row"><span>' + r[0] + '</span><span>' + r[1] + "</span></div>";
    }).join("");
  }

  /* ---------------- WhatsApp backup link ---------------- */

  function buildWaLink() {
    var lines = [
      "Hi Ravi, " + (clientType === "New" ? "enrollment" : "payment") + " submitted:",
      "Name: " + document.getElementById("clientNameHidden").value,
      "Phone: " + document.getElementById("clientPhoneHidden").value
    ];
    if (clientType === "New") {
      lines.push(
        "Age: " + document.getElementById("clientAgeHidden").value,
        "Height: " + document.getElementById("clientHeightHidden").value + " cm",
        "Weight: " + document.getElementById("clientWeightHidden").value + " kg",
        "Diet: " + document.getElementById("dietHidden").value,
        "T&C agreed: Yes"
      );
    }
    lines.push("Payment: Done (screenshot submitted via form)");
    return "https://wa.me/919902269943?text=" + encodeURIComponent(lines.join("\n"));
  }

  /* ---------------- Submit — straight to Supabase ---------------- */

  function sanitizeFileName(name) {
    return (name || "proof").replace(/[^a-zA-Z0-9.]+/g, "-");
  }

  function randomToken() {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  }

  function showSubmitError(msg) {
    submitError.textContent = msg;
    submitError.classList.add("show");
  }

  function hideSubmitError() {
    submitError.classList.remove("show");
  }

  function submitEnrollment() {
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";
    hideSubmitError();

    var file = proofFile.files[0];
    var phone = document.getElementById("clientPhoneHidden").value;
    var filePath = phone + "/" + Date.now() + "-" + randomToken() + "-" + sanitizeFileName(file.name);

    supabaseClient.storage.from("payment-proofs").upload(filePath, file, {
      contentType: file.type,
      upsert: false
    }).then(function (uploadResult) {
      if (uploadResult.error) throw uploadResult.error;

      var age = document.getElementById("clientAgeHidden").value;
      var height = document.getElementById("clientHeightHidden").value;
      var weight = document.getElementById("clientWeightHidden").value;
      var diet = document.getElementById("dietHidden").value;
      var tcAgreedAt = document.getElementById("tcTimestamp").value;
      var tcVersion = document.getElementById("tcVersionField").value;

      return supabaseClient.rpc("submit_enrollment", {
        p_name: document.getElementById("clientNameHidden").value,
        p_phone: phone,
        p_client_type: clientType,
        p_screenshot_path: filePath,
        p_age: clientType === "New" && age !== "" ? Number(age) : null,
        p_height_cm: clientType === "New" && height !== "" ? Number(height) : null,
        p_weight_kg: clientType === "New" && weight !== "" ? Number(weight) : null,
        p_diet: clientType === "New" ? diet : null,
        p_tc_agreed_at: clientType === "New" && tcAgreedAt !== "" ? tcAgreedAt : null,
        p_tc_version: clientType === "New" ? tcVersion : null
      });
    }).then(function (rpcResult) {
      if (rpcResult.error) throw rpcResult.error;
      document.getElementById("waBtn").href = buildWaLink();
      path = { steps: ["done"], labels: [] };
      posInPath = 0;
      showStepKey("done", true);
    }).catch(function (err) {
      console.error(err);
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
      showSubmitError("Couldn't submit — check your internet connection and try again. If it keeps failing, message Ravi directly on WhatsApp.");
    });
  }

  document.getElementById("enrollForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!proofFile.files || !proofFile.files[0]) {
      fileError.classList.add("show");
      uploadBox.classList.add("error");
      return;
    }
    submitEnrollment();
  });

  /* ---------------- Start ---------------- */

  showStepKey("choice", false);
})();
