"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Rail from "./Rail";
import { CONTACT, upiDeepLink, whatsappLink } from "@/app/lib/siteConfig";
import {
  isValidName,
  isValidPhone,
  isInRange,
  isValidDiet,
  MAX_FILE_BYTES,
  ALLOWED_FILE_TYPES,
} from "@/app/lib/validators";
import { loadDraft, saveDraft, clearDraft } from "@/app/lib/enrollDraft";

const PATHS = {
  New: { steps: ["details", "terms", "payment", "proof"], labels: ["Details", "Terms", "Payment", "Proof"] },
  Existing: { steps: ["identify", "payment", "proof"], labels: ["You", "Payment", "Proof"] },
};

const TC_VERSION = "Ravi Fitness Enrollment Terms — v1";

const ERROR_MESSAGES = {
  not_yet_enrolled: 'Looks like this is your first time with Ravi — please go back and choose "New Client" instead, so we can get your details and terms on file.',
  rate_limited: "Too many submissions from this number in a short time. Please wait a few minutes and try again, or message Ravi directly on WhatsApp.",
  invalid_name: "That name doesn't look right — please go back and re-check it.",
  invalid_phone: "That phone number doesn't look right — please go back and re-check it.",
  invalid_age: "Age must be between 10 and 90 — please go back and re-check it.",
  invalid_height: "Height must be between 100 and 230 cm — please go back and re-check it.",
  invalid_weight: "Weight must be between 25 and 250 kg — please go back and re-check it.",
  invalid_diet: "Please go back and choose Veg or Non-veg.",
  terms_not_agreed: "Please go back and accept the terms & conditions first.",
  invalid_file_type: "Please upload a JPG, PNG or WebP image.",
  invalid_file_size: "That file is too large — please upload an image under 5 MB.",
  upload_failed: "Couldn't upload your screenshot. Please try again with a smaller image.",
  server_not_configured: "Something's wrong on our end — please message Ravi directly on WhatsApp instead.",
};

const PHONE_CHECK_ERROR_MESSAGES = {
  invalid_phone: "That phone number doesn't look right — please re-check it.",
  server_not_configured: "Something's wrong on our end — please message Ravi directly on WhatsApp instead.",
};

function phoneCheckErrorMessageFor(code) {
  return PHONE_CHECK_ERROR_MESSAGES[code] || "Couldn't check your number — check your internet connection and try again.";
}

function errorMessageFor(code) {
  return ERROR_MESSAGES[code] || "Couldn't submit — check your internet connection and try again. If it keeps failing, message Ravi directly on WhatsApp.";
}

const STEP_VARIANTS = {
  initial: (dir) => ({ opacity: 0, x: dir >= 0 ? 24 : -24 }),
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] } },
  exit: (dir) => ({ opacity: 0, x: dir >= 0 ? -16 : 16, transition: { duration: 0.2, ease: "easeIn" } }),
};

export default function EnrollForm() {
  const [clientType, setClientType] = useState(null);
  const [posInPath, setPosInPath] = useState(0);
  const [direction, setDirection] = useState(1);
  const [done, setDone] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [showRestoredNote, setShowRestoredNote] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [diet, setDiet] = useState("");
  const [nameEx, setNameEx] = useState("");
  const [phoneEx, setPhoneEx] = useState("");
  const [existingName, setExistingName] = useState("");
  const [existingPaymentCount, setExistingPaymentCount] = useState(0);
  const [existingLastAmount, setExistingLastAmount] = useState(null);
  const [showNameConflict, setShowNameConflict] = useState(false);
  const [touched, setTouched] = useState({});

  const [agreed, setAgreed] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [tcAgreedAt, setTcAgreedAt] = useState("");
  const [tcBox, setTcBox] = useState(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileError, setFileError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErrorCode, setSubmitErrorCode] = useState(null);

  const [checkingPhone, setCheckingPhone] = useState(false);
  const [phoneCheckErrorCode, setPhoneCheckErrorCode] = useState(null);

  const path = clientType ? PATHS[clientType] : null;
  const stepKey = done ? "done" : !clientType ? "phone" : path.steps[posInPath];

  function touch(field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function goTo(i) {
    setDirection(i > posInPath ? 1 : -1);
    setPosInPath(i);
  }

  function back() {
    setDirection(-1);
    if (posInPath === 0) {
      setClientType(null);
      setPhoneCheckErrorCode(null);
    } else {
      setPosInPath(posInPath - 1);
    }
  }

  async function checkPhoneAndContinue() {
    touch("phone");
    if (!isValidPhone(phone)) return;
    setCheckingPhone(true);
    setPhoneCheckErrorCode(null);
    const cleanPhone = phone.trim();
    try {
      const res = await fetch("/api/lookup-client?phone=" + encodeURIComponent(cleanPhone));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.code || "network_error");
      const type = body.clientType === "Existing" ? "Existing" : "New";
      if (type === "Existing") {
        setPhoneEx(cleanPhone);
        setExistingName(body.name || "");
        setNameEx(body.name || "");
        setExistingPaymentCount(body.paymentCount || 0);
        setExistingLastAmount(body.lastAmount ?? null);
      }
      setDirection(1);
      setClientType(type);
      setPosInPath(0);
    } catch (err) {
      setPhoneCheckErrorCode(err?.message || "network_error");
    } finally {
      setCheckingPhone(false);
    }
  }

  useEffect(() => {
    if (!tcBox) return;
    const check = () => {
      const max = tcBox.scrollHeight - tcBox.clientHeight;
      setScrollProgress(max <= 0 ? 100 : Math.min(100, Math.round((tcBox.scrollTop / max) * 100)));
      if (tcBox.scrollTop + tcBox.clientHeight >= tcBox.scrollHeight - 8) setUnlocked(true);
    };
    check();
    tcBox.addEventListener("scroll", check);
    return () => tcBox.removeEventListener("scroll", check);
  }, [tcBox]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    queueMicrotask(() => {
      const draft = loadDraft();
      if (draft) {
        setClientType(draft.clientType ?? null);
        setPosInPath(draft.posInPath ?? 0);
        setName(draft.name ?? "");
        setPhone(draft.phone ?? "");
        setAge(draft.age ?? "");
        setHeight(draft.height ?? "");
        setWeight(draft.weight ?? "");
        setDiet(draft.diet ?? "");
        setNameEx(draft.nameEx ?? "");
        setPhoneEx(draft.phoneEx ?? "");
        setExistingName(draft.existingName ?? "");
        setExistingPaymentCount(draft.existingPaymentCount ?? 0);
        setExistingLastAmount(draft.existingLastAmount ?? null);
        setAgreed(draft.agreed ?? false);
        setUnlocked(draft.unlocked ?? false);
        setTcAgreedAt(draft.tcAgreedAt ?? "");
        setShowRestoredNote(true);
      }
      setDraftReady(true);
    });
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    if (!clientType) {
      clearDraft();
      return;
    }
    saveDraft({
      clientType, posInPath,
      name, phone, age, height, weight, diet,
      nameEx, phoneEx, existingName, existingPaymentCount, existingLastAmount,
      agreed, unlocked, tcAgreedAt,
    });
  }, [
    draftReady, clientType, posInPath,
    name, phone, age, height, weight, diet,
    nameEx, phoneEx, existingName, existingPaymentCount, existingLastAmount,
    agreed, unlocked, tcAgreedAt,
  ]);

  useEffect(() => {
    if (done) clearDraft();
  }, [done]);

  function validateDetails(showErrors) {
    const nameOk = isValidName(name);
    const phoneOk = isValidPhone(phone);
    const ageOk = isInRange(age, "age");
    const heightOk = isInRange(height, "height_cm");
    const weightOk = isInRange(weight, "weight_kg");
    const dietOk = isValidDiet(diet);
    if (showErrors) {
      setTouched((t) => ({ ...t, name: true, phone: true, age: true, height: true, weight: true, diet: true }));
    }
    return nameOk && phoneOk && ageOk && heightOk && weightOk && dietOk;
  }

  function validateIdentify(showErrors) {
    const nameOk = isValidName(nameEx);
    const phoneOk = isValidPhone(phoneEx);
    if (showErrors) {
      setTouched((t) => ({ ...t, nameEx: true, phoneEx: true }));
    }
    return nameOk && phoneOk;
  }

  function next() {
    if (stepKey === "details" && !validateDetails(true)) return;
    if (stepKey === "identify") {
      if (!validateIdentify(true)) return;
      const nameChanged = existingName && nameEx.trim().toLowerCase() !== existingName.trim().toLowerCase();
      if (nameChanged) {
        setShowNameConflict(true);
        return;
      }
    }
    goTo(posInPath + 1);
  }

  function handleAgreeChange(e) {
    const checked = e.target.checked;
    setAgreed(checked);
    if (checked) setTcAgreedAt(new Date().toISOString());
  }

  function handleFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const validType = ALLOWED_FILE_TYPES.includes(f.type);
    const validSize = f.size <= MAX_FILE_BYTES;
    if (!validType || !validSize) {
      setFileError(true);
      setFile(null);
      setPreviewUrl(null);
      e.target.value = "";
      return;
    }
    setFileError(false);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function buildWaLink() {
    const lines = [
      "Hi Ravi, " + (clientType === "New" ? "enrollment" : "payment") + " submitted:",
      "Name: " + (clientType === "New" ? name : nameEx),
      "Phone: " + (clientType === "New" ? phone : phoneEx),
    ];
    if (clientType === "New") {
      lines.push("Age: " + age, "Height: " + height + " cm", "Weight: " + weight + " kg", "Diet: " + diet, "T&C agreed: Yes");
    }
    lines.push("Payment: Done (screenshot submitted via form)");
    return whatsappLink(lines.join("\n"));
  }

  function buildFallbackWaLink() {
    const lines = [
      "Hi Ravi, I'm having trouble submitting my " + (clientType === "New" ? "enrollment" : "payment") + " on the website. My details:",
      "Name: " + (clientType === "New" ? name : nameEx),
      "Phone: " + (clientType === "New" ? phone : phoneEx),
      "(Sending the payment screenshot here directly.)",
    ];
    return whatsappLink(lines.join("\n"));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setFileError(true);
      return;
    }
    setSubmitting(true);
    setSubmitErrorCode(null);

    const params = new URLSearchParams({
      phone: clientType === "New" ? phone : phoneEx,
      filename: file.name,
      name: clientType === "New" ? name : nameEx,
      client_type: clientType,
      age: clientType === "New" ? age : "",
      height_cm: clientType === "New" ? height : "",
      weight_kg: clientType === "New" ? weight : "",
      diet: clientType === "New" ? diet : "",
      tc_agreed_at: clientType === "New" ? tcAgreedAt : "",
      tc_version: clientType === "New" ? TC_VERSION : "",
    });

    try {
      const res = await fetch("/api/submit-enrollment?" + params.toString(), {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.code || "network_error");
      setDone(true);
    } catch (err) {
      setSubmitting(false);
      setSubmitErrorCode(err?.message || "network_error");
    }
  }

  return (
    <div className="app">
      <div className="brand">
        <div className="brand-id">
          <Image className="brand-photo" src="/ravi.jpg" alt="Ravi, personal trainer" width={96} height={94} />
          <div>
            <span className="brand-name">RAVI</span>
            <span className="brand-sub">Your Personal Trainer</span>
          </div>
        </div>
        <span className="brand-tag">Enrollment</span>
      </div>

      <div className="stat-row">
        <div className="stat-chip"><strong>8+</strong> yrs experience</div>
        <div className="stat-chip"><strong>1000+</strong> transformations</div>
      </div>

      {path && stepKey !== "done" && <Rail labels={path.labels} posInPath={posInPath} />}
      {showRestoredNote && stepKey !== "done" && <p className="restored-note">↺ Continuing where you left off</p>}

      <div className="card">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stepKey}
            custom={direction}
            variants={STEP_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
          >
          {stepKey === "phone" && (
            <>
              <p className="step-eyebrow">Welcome</p>
              <h2 className="step-title display">Let&apos;s get started</h2>
              <p className="amount-note">Enter your phone number — we&apos;ll take it from there.</p>
              <div className={"field" + (touched.phone && !isValidPhone(phone) ? " error" : "")}>
                <label htmlFor="clientPhone0">Phone number</label>
                <input
                  id="clientPhone0"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => touch("phone")}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); checkPhoneAndContinue(); } }}
                />
                <p className="error-msg">Enter a valid 10-digit Indian mobile number.</p>
              </div>
              {phoneCheckErrorCode && (
                <p className="submit-error-msg show">
                  {phoneCheckErrorMessageFor(phoneCheckErrorCode)}{" "}
                  <a className="submit-error-wa" href={whatsappLink("Hi Ravi, I'm having trouble starting my enrollment on the website.")} target="_blank" rel="noopener">Message Ravi on WhatsApp →</a>
                </p>
              )}
              <div className="actions">
                <button type="button" className="btn btn-primary" disabled={checkingPhone} onClick={checkPhoneAndContinue}>
                  {checkingPhone && <Spinner />}{checkingPhone ? "Checking…" : "Continue →"}
                </button>
              </div>
            </>
          )}

          {stepKey === "details" && (
            <>
              <p className="step-eyebrow">Step {posInPath + 1} of {path.steps.length}</p>
              <h2 className="step-title display">Your Details</h2>
              <div className={"field" + (touched.name && !isValidName(name) ? " error" : "")}>
                <label htmlFor="clientName">Full name</label>
                <input id="clientName" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => touch("name")} />
                <p className="error-msg">Enter your full name (at least 2 letters).</p>
              </div>
              <div className={"field" + (touched.phone && !isValidPhone(phone) ? " error" : "")}>
                <label htmlFor="clientPhone">Phone number</label>
                <input id="clientPhone" type="tel" autoComplete="tel" inputMode="tel" placeholder="So Ravi can reach you" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => touch("phone")} />
                <p className="error-msg">Enter a valid 10-digit Indian mobile number.</p>
              </div>
              <div className="row2">
                <NumberField
                  id="clientAge"
                  label="Age"
                  value={age}
                  onChange={setAge}
                  onBlur={() => touch("age")}
                  min={10}
                  max={90}
                  error={touched.age && !isInRange(age, "age")}
                  errorMsg="Age must be between 10 and 90."
                />
                <NumberField
                  id="clientHeight"
                  label="Height (cm)"
                  value={height}
                  onChange={setHeight}
                  onBlur={() => touch("height")}
                  min={100}
                  max={230}
                  unit="cm"
                  error={touched.height && !isInRange(height, "height_cm")}
                  errorMsg="Height must be between 100 and 230 cm."
                />
              </div>
              <div className="row2">
                <NumberField
                  id="clientWeight"
                  label="Weight (kg)"
                  value={weight}
                  onChange={setWeight}
                  onBlur={() => touch("weight")}
                  min={25}
                  max={250}
                  step={0.5}
                  unit="kg"
                  error={touched.weight && !isInRange(weight, "weight_kg")}
                  errorMsg="Weight must be between 25 and 250 kg."
                />
                <div className={"field" + (touched.diet && !isValidDiet(diet) ? " error" : "")}>
                  <label>Diet</label>
                  <div className={"pillgroup" + (touched.diet && !isValidDiet(diet) ? " error" : "")} role="group" aria-label="Diet">
                    {["Veg", "Non-veg"].map((v) => (
                      <div key={v} className={"pill" + (diet === v ? " selected" : "")} role="button" tabIndex={0} aria-pressed={diet === v}
                        onClick={() => { setDiet(v); touch("diet"); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDiet(v); touch("diet"); } }}>
                        {v}
                      </div>
                    ))}
                  </div>
                  <p className="error-msg">Choose Veg or Non-veg.</p>
                </div>
              </div>
              <div className="actions">
                <button type="button" className="btn btn-ghost" onClick={back}>← Back</button>
                <button type="button" className="btn btn-primary" onClick={next}>Continue →</button>
              </div>
            </>
          )}

          {stepKey === "identify" && (
            <>
              <p className="step-eyebrow">Step {posInPath + 1} of {path.steps.length}</p>
              <motion.h2
                className="step-title display welcome-name"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                Welcome back{existingName ? ", " + existingName.split(" ")[0] : ""}!
              </motion.h2>
              {existingPaymentCount > 0 && (
                <p className="streak-note">This will be payment #{existingPaymentCount + 1} with Ravi 💪</p>
              )}
              <div className="field">
                <label htmlFor="clientPhoneExDisplay">Phone number</label>
                <input id="clientPhoneExDisplay" type="tel" value={phoneEx} disabled readOnly />
              </div>
              <div className={"field" + (touched.nameEx && !isValidName(nameEx) ? " error" : "")}>
                <label htmlFor="clientNameEx">Full name</label>
                <input
                  id="clientNameEx"
                  type="text"
                  autoComplete="name"
                  value={nameEx}
                  onChange={(e) => { setNameEx(e.target.value); setShowNameConflict(false); }}
                  onBlur={() => touch("nameEx")}
                />
                <p className="error-msg">Enter your full name (at least 2 letters).</p>
              </div>

              {showNameConflict ? (
                <>
                  <div className="warn-box">
                    This number is on file as <strong>{existingName}</strong>, not &quot;{nameEx.trim()}&quot;. Are you the same person fixing a typo, or does someone else use this phone too?
                  </div>
                  <div className="actions" style={{ flexDirection: "column" }}>
                    <button type="button" className="btn btn-primary" onClick={() => { setShowNameConflict(false); goTo(posInPath + 1); }}>
                      That&apos;s me — just fixing a typo →
                    </button>
                    <a
                      className="wa-btn"
                      href={whatsappLink(`Hi Ravi, this number shows as ${existingName}'s on your system but I'm a different person (${nameEx.trim()}). Can you help set up my own record?`)}
                      target="_blank"
                      rel="noopener"
                    >
                      📲 Different person — message Ravi
                    </a>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowNameConflict(false)}>← Back to editing</button>
                  </div>
                </>
              ) : (
                <div className="actions">
                  <button type="button" className="btn btn-ghost" onClick={back}>← Not you? Go back</button>
                  <button type="button" className="btn btn-primary" onClick={next}>Continue to Payment →</button>
                </div>
              )}
            </>
          )}

          {stepKey === "terms" && (
            <>
              <p className="step-eyebrow">Step {posInPath + 1} of {path.steps.length}</p>
              <h2 className="step-title display">Terms &amp; Conditions</h2>
              <div className="cycle-strip" aria-hidden="true">
                <div className="cycle-block">WK 1</div>
                <div className="cycle-block">WK 2</div>
                <div className="cycle-block">WK 3</div>
                <div className="cycle-block">WK 4</div>
                <span className="cycle-arrow">→</span>
                <div className="cycle-block pay">PAY</div>
              </div>
              <div className="tc-box" ref={setTcBox}>
                <h4>Program structure</h4>
                <p>Training runs in 4-week blocks, counted strictly week-wise — not by calendar month or fixed start/end dates.</p>
                <h4>Class days</h4>
                <p>Classes are held Monday to Friday only. No classes on Saturday or Sunday.</p>
                <h4>Payment schedule</h4>
                <p>Payment for the next 4-week block is due at the start of Week 5 of the current block.</p>
                <h4>Refund policy</h4>
                <p>No refunds are issued under any circumstances.</p>
                <h4>If a class is cancelled by the trainer</h4>
                <p>A makeup class will be scheduled to cover it. Payment still continues on the normal week-wise schedule regardless of makeup classes.</p>
                <h4>If a class is cancelled by the client</h4>
                <ul>
                  <li>You must inform the trainer at least 1 hour before the scheduled class.</li>
                  <li>No notice, or less than 1 hour&apos;s notice — that class is counted as done, no makeup.</li>
                  <li>Notice given in time — once payment for the next block (Week 5) is made, you may take a makeup class on your own, whenever you&apos;re free.</li>
                </ul>
                <h4>Payment confirmation</h4>
                <p>After paying, you must share a screenshot of the payment as confirmation — the next steps in this form.</p>
              </div>
              <div className="scroll-progress-track" aria-hidden="true">
                <motion.div className="scroll-progress-fill" animate={{ width: scrollProgress + "%" }} transition={{ duration: 0.15 }} />
              </div>
              {!unlocked && <p className="scroll-hint">↓ Scroll to the end to unlock the checkbox</p>}
              <div className={"agree-row" + (unlocked ? " unlocked" : "")}>
                <input type="checkbox" id="agreeBox" disabled={!unlocked} checked={agreed} onChange={handleAgreeChange} />
                <label htmlFor="agreeBox">I have read and agree to the terms &amp; conditions above.</label>
              </div>
              <div className="actions" style={{ marginTop: 18 }}>
                <button type="button" className="btn btn-ghost" onClick={back}>← Back</button>
                <button type="button" className="btn btn-primary" disabled={!agreed} onClick={next}>Continue to Payment →</button>
              </div>
            </>
          )}

          {stepKey === "payment" && (
            <>
              <p className="step-eyebrow">Step {posInPath + 1} of {path.steps.length}</p>
              <h2 className="step-title display">Payment</h2>
              <div className="qr-wrap">
                <Image src="/qr.jpg" alt="PhonePe QR code for Ravindra M B" width={190} height={328} />
              </div>
              <a className="upi-pay-btn" href={upiDeepLink()}>📲 Pay via UPI app</a>
              <div className="upi-row">
                <div>
                  {CONTACT.upiId}
                  <div className="payee">{CONTACT.upiPayee} · PhonePe</div>
                </div>
                <CopyUpiButton />
              </div>
              {clientType === "Existing" && existingLastAmount != null && (
                <p className="last-amount-note">You paid ₹{existingLastAmount} last time — pay the same unless Ravi told you otherwise.</p>
              )}
              <p className="amount-note">On your phone, tap &quot;Pay via UPI app&quot; to open PhonePe/GPay/Paytm directly — or scan the QR, or copy the UPI ID above into any UPI app. Confirm the amount with Ravi before paying if you haven&apos;t already.</p>
              <div className="actions">
                <button type="button" className="btn btn-ghost" onClick={back}>← Back</button>
                <button type="button" className="btn btn-primary" onClick={next}>I&apos;ve Paid — Continue →</button>
              </div>
            </>
          )}

          {stepKey === "proof" && (
            <form onSubmit={handleSubmit}>
              <p className="step-eyebrow">Step {posInPath + 1} of {path.steps.length}</p>
              <h2 className="step-title display">Payment Proof</h2>
              <label className={"upload-box" + (fileError ? " error" : "")} htmlFor="proofFile">
                {!previewUrl && (
                  <div>
                    <div className="icon">📎</div>
                    <div><strong>Tap to upload screenshot</strong></div>
                    <div className="hint">JPG, PNG or WebP, up to 5 MB</div>
                  </div>
                )}
                {previewUrl && <img className="preview-img" style={{ display: "block" }} src={previewUrl} alt="Payment screenshot preview" />}
              </label>
              <input type="file" id="proofFile" accept="image/png,image/jpeg,image/webp" onChange={handleFile} style={{ display: "none" }} />
              {fileError && <p className="file-error-msg show">Please upload a JPG, PNG or WebP under 5 MB.</p>}

              <div className="summary">
                <div className="summary-row"><span>Name</span><span>{clientType === "New" ? name : nameEx}</span></div>
                <div className="summary-row"><span>Phone</span><span>{clientType === "New" ? phone : phoneEx}</span></div>
                {clientType === "New" && (
                  <>
                    <div className="summary-row"><span>Age</span><span>{age}</span></div>
                    <div className="summary-row"><span>Height</span><span>{height} cm</span></div>
                    <div className="summary-row"><span>Weight</span><span>{weight} kg</span></div>
                    <div className="summary-row"><span>Diet</span><span>{diet}</span></div>
                  </>
                )}
              </div>

              <div className="warn-box">No refunds. Payment is week-wise, due at the start of Week 5.</div>
              {submitErrorCode && (
                <p className="submit-error-msg show">
                  {errorMessageFor(submitErrorCode)}{" "}
                  <a className="submit-error-wa" href={buildFallbackWaLink()} target="_blank" rel="noopener">Message Ravi on WhatsApp →</a>
                </p>
              )}

              <div className="actions">
                <button type="button" className="btn btn-ghost" onClick={back}>← Back</button>
                <button type="submit" className="btn btn-primary" disabled={!file || submitting}>{submitting && <Spinner />}{submitting ? "Submitting…" : "Submit"}</button>
              </div>
            </form>
          )}

          {stepKey === "done" && (
            <div className="done-wrap">
              <div className="done-badge-wrap">
                <div className="done-badge">
                  <motion.svg width="34" height="34" viewBox="0 0 62 62" fill="none">
                    <motion.circle
                      cx="31" cy="31" r="29" stroke="var(--success)" strokeWidth="2.5"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                    <motion.path
                      d="M19 32l8 8 16-18" stroke="var(--success)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.4, ease: "easeOut" }}
                    />
                  </motion.svg>
                </div>
                <Burst />
              </div>
              <h2 className="display">You&apos;re all set</h2>
              <p>Ravi has received your submission — details, payment confirmation and screenshot. He&apos;ll confirm shortly.</p>
              <a className="wa-btn" href={buildWaLink()} target="_blank" rel="noopener">📲 Also send a note on WhatsApp</a>
            </div>
          )}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="foot">
        Ravi · Personal Training · <a href={CONTACT.instagramUrl} target="_blank" rel="noopener">{CONTACT.instagramHandle}</a>
        <br />
        <Link href="/status">Already enrolled? Check your status →</Link>
      </footer>
    </div>
  );
}

function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

function Burst() {
  const particles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        return { x: Math.cos(angle) * 46, y: Math.sin(angle) * 46, delay: i * 0.02 };
      }),
    []
  );
  return (
    <div className="done-burst" aria-hidden="true">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="done-particle"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.7, delay: 0.35 + p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function NumberField({ id, label, value, onChange, onBlur, min, max, step = 1, unit, error, errorMsg }) {
  function clamp(n) {
    if (Number.isNaN(n)) return String(min);
    return String(Math.min(max, Math.max(min, n)));
  }
  function bump(delta) {
    const current = Number(value);
    onChange(clamp((Number.isFinite(current) ? current : min) + delta));
  }
  return (
    <div className={"field" + (error ? " error" : "")}>
      <label htmlFor={id}>{label}</label>
      <div className="stepper">
        <button type="button" className="stepper-btn" onClick={() => bump(-step)} aria-label={"Decrease " + label}>−</button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          className="stepper-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        {unit && <span className="stepper-unit">{unit}</span>}
        <button type="button" className="stepper-btn" onClick={() => bump(step)} aria-label={"Increase " + label}>+</button>
      </div>
      <p className="error-msg">{errorMsg}</p>
    </div>
  );
}

function CopyUpiButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={"copy-btn" + (copied ? " copied" : "")}
      onClick={() => {
        navigator.clipboard.writeText(CONTACT.upiId).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
