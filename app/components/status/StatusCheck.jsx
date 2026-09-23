"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CONTACT, whatsappLink } from "@/app/lib/siteConfig";
import { isValidPhone } from "@/app/lib/validators";

const STATUS_ERROR_MESSAGES = {
  invalid_phone: "That phone number doesn't look right — please re-check it.",
  server_not_configured: "Something's wrong on our end — please message Ravi directly on WhatsApp instead.",
};

function statusErrorMessageFor(code) {
  return STATUS_ERROR_MESSAGES[code] || "Couldn't check your status — check your internet connection and try again.";
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function StatusBadge({ status }) {
  if (status === "confirmed") return <span className="badge badge-confirmed">Confirmed</span>;
  if (status === "rejected") return <span className="badge badge-rejected">Rejected</span>;
  return <span className="badge badge-pending">Pending</span>;
}

export default function StatusCheck() {
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [checking, setChecking] = useState(false);
  const [errorCode, setErrorCode] = useState(null);
  const [result, setResult] = useState(null);

  async function check() {
    setTouched(true);
    if (!isValidPhone(phone)) return;
    setChecking(true);
    setErrorCode(null);
    setResult(null);
    try {
      const res = await fetch("/api/client-status?phone=" + encodeURIComponent(phone.trim()));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.code || "network_error");
      setResult(body);
    } catch (err) {
      setErrorCode(err?.message || "network_error");
    } finally {
      setChecking(false);
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
        <span className="brand-tag">My Status</span>
      </div>

      <div className="card">
        <div>
          <p className="step-eyebrow">Check In</p>
          <h2 className="step-title display">Your Status</h2>
          <p className="amount-note">Enter your phone number to see your enrollment with Ravi.</p>

          <div className={"field" + (touched && !isValidPhone(phone) ? " error" : "")}>
            <label htmlFor="statusPhone">Phone number</label>
            <input
              id="statusPhone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setResult(null); setErrorCode(null); }}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); check(); } }}
            />
            <p className="error-msg">Enter a valid 10-digit Indian mobile number.</p>
          </div>

          {errorCode && <p className="submit-error-msg show">{statusErrorMessageFor(errorCode)}</p>}

          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={checking} onClick={check}>
              {checking ? "Checking…" : "Check Status →"}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {result?.found && (
              <motion.div
                key="found"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="status-result"
              >
                <h3 className="display status-name">{result.name}</h3>
                <div className="summary">
                  <div className="summary-row"><span>Member since</span><span>{formatDate(result.memberSince)}</span></div>
                  <div className="summary-row"><span>Payments made</span><span>{result.totalPayments}</span></div>
                  <div className="summary-row"><span>Last payment</span><span>{formatDate(result.lastPayment.submittedAt)}</span></div>
                  <div className="summary-row">
                    <span>Status</span>
                    <StatusBadge status={result.lastPayment.status} />
                  </div>
                </div>
                <p className="amount-note">For your exact next class or payment date, message Ravi directly — this page doesn&apos;t track class attendance.</p>
                <a className="wa-btn" href={whatsappLink("Hi Ravi, checking in about my training schedule.")} target="_blank" rel="noopener">📲 Message Ravi on WhatsApp</a>
              </motion.div>
            )}
            {result && !result.found && (
              <motion.div
                key="not-found"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="status-result"
              >
                <p className="amount-note">We don&apos;t have a completed enrollment on file for this number yet.</p>
                <Link className="btn btn-primary status-enroll-link" href="/">Enroll now →</Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <footer className="foot">
        Ravi · Personal Training · <a href={CONTACT.instagramUrl} target="_blank" rel="noopener">{CONTACT.instagramHandle}</a>
        <br />
        <Link href="/">← Back to enrollment</Link>
      </footer>
    </div>
  );
}
