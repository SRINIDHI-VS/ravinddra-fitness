"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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

export default function EnrollForm() {
  const [clientType, setClientType] = useState(null);
  const [posInPath, setPosInPath] = useState(0);
  const [done, setDone] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  // Details (New) / Identify (Existing) — kept separate so switching client
  // type never mixes up a half-filled draft from the other path.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [diet, setDiet] = useState("");
  const [nameEx, setNameEx] = useState("");
  const [phoneEx, setPhoneEx] = useState("");
  const [touched, setTouched] = useState({});

  // Terms
  const [agreed, setAgreed] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [tcAgreedAt, setTcAgreedAt] = useState("");
  const tcBoxRef = useRef(null);

  // Proof + submit
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileError, setFileError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErrorCode, setSubmitErrorCode] = useState(null);

  // Phone-first lookup — this is what decides New vs Existing now, instead
  // of asking the visitor to pick.
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [phoneCheckErrorCode, setPhoneCheckErrorCode] = useState(null);

  const path = clientType ? PATHS[clientType] : null;
  const stepKey = done ? "done" : !clientType ? "phone" : path.steps[posInPath];

  function touch(field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function goTo(i) {
    setPosInPath(i);
    setAnimKey((k) => k + 1);
  }

  function back() {
    if (posInPath === 0) {
      setClientType(null);
      setPhoneCheckErrorCode(null);
    } else {
      goTo(posInPath - 1);
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
      if (type === "Existing") setPhoneEx(cleanPhone);
      setClientType(type);
      setPosInPath(0);
      setAnimKey((k) => k + 1);
    } catch (err) {
      setPhoneCheckErrorCode(err?.message || "network_error");
    } finally {
      setCheckingPhone(false);
    }
  }

  // Terms scroll-to-unlock. Only mounted while the "terms" step is actually
  // rendered, so — unlike the old vanilla build — there's no hidden, 0-height
  // version of this box for a load-time check to misread as "already at the
  // bottom." The check runs once right after this box actually has real
  // layout, and again on every real scroll.
  useEffect(() => {
    if (stepKey !== "terms") return;
    const box = tcBoxRef.current;
    if (!box) return;
    const check = () => {
      if (box.scrollTop + box.clientHeight >= box.scrollHeight - 8) setUnlocked(true);
    };
    check();
    box.addEventListener("scroll", check);
    return () => box.removeEventListener("scroll", check);
  }, [stepKey]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

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
    if (stepKey === "identify" && !validateIdentify(true)) return;
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

      <div className="card">
        <div key={animKey} className={stepKey === "phone" || stepKey === "done" ? "step active" : "step active slide-in"}>
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
                  {checkingPhone ? "Checking…" : "Continue →"}
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
                <div className={"field" + (touched.age && !isInRange(age, "age") ? " error" : "")}>
                  <label htmlFor="clientAge">Age</label>
                  <input id="clientAge" type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} onBlur={() => touch("age")} />
                  <p className="error-msg">Age must be between 10 and 90.</p>
                </div>
                <div className={"field" + (touched.height && !isInRange(height, "height_cm") ? " error" : "")}>
                  <label htmlFor="clientHeight">Height (cm)</label>
                  <input id="clientHeight" type="number" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} onBlur={() => touch("height")} />
                  <p className="error-msg">Height must be between 100 and 230 cm.</p>
                </div>
              </div>
              <div className="row2">
                <div className={"field" + (touched.weight && !isInRange(weight, "weight_kg") ? " error" : "")}>
                  <label htmlFor="clientWeight">Weight (kg)</label>
                  <input id="clientWeight" type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} onBlur={() => touch("weight")} />
                  <p className="error-msg">Weight must be between 25 and 250 kg.</p>
                </div>
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
              <h2 className="step-title display">Welcome Back</h2>
              <div className="field">
                <label htmlFor="clientPhoneExDisplay">Phone number</label>
                <input id="clientPhoneExDisplay" type="tel" value={phoneEx} disabled readOnly />
              </div>
              <div className={"field" + (touched.nameEx && !isValidName(nameEx) ? " error" : "")}>
                <label htmlFor="clientNameEx">Full name</label>
                <input id="clientNameEx" type="text" autoComplete="name" value={nameEx} onChange={(e) => setNameEx(e.target.value)} onBlur={() => touch("nameEx")} />
                <p className="error-msg">Enter your full name (at least 2 letters).</p>
              </div>
              <div className="actions">
                <button type="button" className="btn btn-ghost" onClick={back}>← Not you? Go back</button>
                <button type="button" className="btn btn-primary" onClick={next}>Continue to Payment →</button>
              </div>
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
              <div className="tc-box" ref={tcBoxRef}>
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
                <button type="submit" className="btn btn-primary" disabled={!file || submitting}>{submitting ? "Submitting…" : "Submit"}</button>
              </div>
            </form>
          )}

          {stepKey === "done" && (
            <div className="done-wrap">
              <div className="done-badge">✓</div>
              <h2 className="display">You&apos;re all set</h2>
              <p>Ravi has received your submission — details, payment confirmation and screenshot. He&apos;ll confirm shortly.</p>
              <a className="wa-btn" href={buildWaLink()} target="_blank" rel="noopener">📲 Also send a note on WhatsApp</a>
            </div>
          )}
        </div>
      </div>

      <footer className="foot">
        Ravi · Personal Training · <a href={CONTACT.instagramUrl} target="_blank" rel="noopener">{CONTACT.instagramHandle}</a>
      </footer>
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
