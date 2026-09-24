"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CONTACT, whatsappLink } from "@/app/lib/siteConfig";
import GymDecor from "@/app/components/GymDecor";
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

function daysAgoLabel(iso) {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 30) return diff + " days ago";
  const months = Math.round(diff / 30);
  return months <= 1 ? "about a month ago" : months + " months ago";
}

function StatusBadge({ status }) {
  if (status === "confirmed") return <span className="badge badge-confirmed">Confirmed</span>;
  if (status === "rejected") return <span className="badge badge-rejected">Rejected</span>;
  return <span className="badge badge-pending">Pending</span>;
}

function StatusIconBadge({ status }) {
  const normalized = status === "confirmed" || status === "rejected" ? status : "pending";
  const icon = normalized === "confirmed" ? "✓" : normalized === "rejected" ? "✕" : "⏳";
  return (
    <div className="status-badge-wrap">
      <div className={"status-icon-badge " + normalized}>{icon}</div>
    </div>
  );
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
      <GymDecor />
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
                <StatusIconBadge status={result.lastPayment.status} />
                <h3 className="display status-name">{result.name}</h3>
                <div className="summary">
                  <div className="summary-row"><span>Member since</span><span>{formatDate(result.memberSince)}</span></div>
                  <div className="summary-row"><span>Payments made</span><span>{result.totalPayments}</span></div>
                  <div className="summary-row">
                    <span>Last payment</span>
                    <span>
                      {formatDate(result.lastPayment.submittedAt)}
                      {daysAgoLabel(result.lastPayment.submittedAt) && (
                        <span className="cell-sub"> · {daysAgoLabel(result.lastPayment.submittedAt)}</span>
                      )}
                    </span>
                  </div>
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
                <div className="not-found-icon" aria-hidden="true">🔍</div>
                <p className="amount-note" style={{ textAlign: "center" }}>We don&apos;t have a completed enrollment on file for this number yet.</p>
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
