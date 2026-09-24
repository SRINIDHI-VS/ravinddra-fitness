"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/app/lib/supabaseClient";
import { lastPaymentAmount } from "@/app/lib/clients";
import { isValidName, isValidPhone, isValidAmount } from "@/app/lib/validators";

function toLocalDatetimeValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
    "T" + pad(date.getHours()) + ":" + pad(date.getMinutes())
  );
}

export default function LogPaymentModal({ clients, rows, initialClient, onClose, onLogged }) {
  const [query, setQuery] = useState(initialClient ? initialClient.name || initialClient.phone : "");
  const [selected, setSelected] = useState(initialClient || null);
  const [mode, setMode] = useState(initialClient ? "existing" : "search");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [amount, setAmount] = useState(initialClient ? lastPaymentAmount(rows, initialClient.id) : "");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState(() => toLocalDatetimeValue(new Date()));
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const suggestions = useMemo(() => {
    if (mode !== "search" || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    return clients.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q)).slice(0, 6);
  }, [clients, query, mode]);

  function pickClient(c) {
    setSelected(c);
    setMode("existing");
    setQuery(c.name || c.phone);
    setAmount(lastPaymentAmount(rows, c.id));
  }

  function startNewClient() {
    setMode("new");
    setNewName(query.trim());
    setSelected(null);
  }

  function changeClient() {
    setMode("search");
    setSelected(null);
    setQuery("");
    setAmount("");
  }

  function touch(field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  const newNameOk = isValidName(newName);
  const newPhoneOk = isValidPhone(newPhone);
  const amountOk = isValidAmount(amount);
  const canSubmit = amountOk && (mode === "existing" ? !!selected : mode === "new" ? newNameOk && newPhoneOk : false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (mode === "new") setTouched((t) => ({ ...t, newName: true, newPhone: true }));
    setTouched((t) => ({ ...t, amount: true }));
    if (!canSubmit) return;

    setSaving(true);
    setError(null);
    const whenIso = new Date(when).toISOString();

    try {
      let clientId = selected?.id;
      let clientType = "Existing";

      if (mode === "new") {
        const { data, error: clientErr } = await supabase
          .from("clients")
          .upsert({ name: newName.trim(), phone: newPhone.trim() }, { onConflict: "phone" })
          .select("id")
          .single();
        if (clientErr) throw clientErr;
        clientId = data.id;
        clientType = "New";
      }

      const { error: payErr } = await supabase.from("payments").insert({
        client_id: clientId,
        client_type: clientType,
        screenshot_path: null,
        status: "confirmed",
        tc_agreed_at: null,
        submitted_at: whenIso,
        confirmed_at: whenIso,
        amount: amount === "" ? null : Number(amount),
        transaction_ref: note.trim() || null,
        source: "admin_manual",
      });
      if (payErr) throw payErr;

      onLogged();
      onClose();
    } catch (err) {
      setError(err?.message?.includes("duplicate") ? "Another client already has that phone number." : "Could not save — try again.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <h3 className="modal-title">Log a Payment</h3>
        <p className="modal-sub">For a client who already paid you directly — no screenshot needed, you&apos;re confirming it yourself.</p>

        <form onSubmit={handleSubmit}>
          {mode !== "new" && (
            <div className="field">
              <label htmlFor="logClientSearch">Client</label>
              {selected ? (
                <div className="picked-client">
                  <div>
                    <div className="cell-name">{selected.name}</div>
                    <div className="cell-sub">{selected.phone}</div>
                  </div>
                  <button type="button" className="row-btn" onClick={changeClient}>Change</button>
                </div>
              ) : (
                <>
                  <input
                    id="logClientSearch"
                    type="text"
                    placeholder="Search by name or phone…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                  />
                  {suggestions.length > 0 && (
                    <div className="client-suggest">
                      {suggestions.map((c) => (
                        <button type="button" key={c.id} className="client-suggest-row" onClick={() => pickClient(c)}>
                          <span className="cell-name">{c.name}</span>
                          <span className="cell-sub">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {query.trim().length > 1 && suggestions.length === 0 && (
                    <button type="button" className="row-btn client-suggest-new" onClick={startNewClient}>
                      + Add &quot;{query.trim()}&quot; as a new client
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {mode === "new" && (
            <>
              <div className="submit-error-msg show" style={{ color: "var(--warn)", background: "color-mix(in srgb, var(--warn) 10%, transparent)", borderColor: "color-mix(in srgb, var(--warn) 40%, transparent)" }}>
                No digital terms &amp; conditions record will exist for this client — make sure they&apos;ve agreed to your terms in person first.
              </div>
              <div className={"field" + (touched.newName && !newNameOk ? " error" : "")}>
                <label htmlFor="logNewName">Full name</label>
                <input id="logNewName" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => touch("newName")} />
                <p className="error-msg">Enter their full name (at least 2 letters).</p>
              </div>
              <div className={"field" + (touched.newPhone && !newPhoneOk ? " error" : "")}>
                <label htmlFor="logNewPhone">Phone number</label>
                <input id="logNewPhone" type="tel" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} onBlur={() => touch("newPhone")} />
                <p className="error-msg">Enter a valid 10-digit Indian mobile number.</p>
              </div>
              <button type="button" className="row-btn" onClick={changeClient}>← Search instead</button>
            </>
          )}

          <div className="row2" style={{ marginTop: 16 }}>
            <div className={"field" + (touched.amount && !amountOk ? " error" : "")}>
              <label htmlFor="logAmount">Amount (₹, optional)</label>
              <input id="logAmount" type="number" inputMode="decimal" min="1" max="100000" value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={() => touch("amount")} />
              <p className="error-msg">Enter an amount between ₹1 and ₹1,00,000, or leave it blank.</p>
            </div>
            <div className="field">
              <label htmlFor="logWhen">Paid on</label>
              <input id="logWhen" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="logNote">Note (optional)</label>
            <input id="logNote" type="text" placeholder="e.g. cash, or last 4 of UPI ref" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="submit-error-msg show">{error}</p>}

          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !canSubmit}>
              {saving && <span className="spinner" aria-hidden="true" />}{saving ? "Saving…" : "Log Payment"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
