"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import LoginScreen from "./LoginScreen";
import PaymentsView from "./PaymentsView";
import ClientsView from "./ClientsView";
import RenewalsView from "./RenewalsView";

function computeStats(rows) {
  const uniqueClients = new Set();
  const now = new Date();
  let thisMonthCount = 0;
  let pendingCount = 0;
  rows.forEach((r) => {
    if (r.clients) uniqueClients.add(r.clients.id);
    const d = new Date(r.submitted_at);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) thisMonthCount++;
    if (r.status === "submitted") pendingCount++;
  });
  return { clients: uniqueClients.size, thisMonth: thisMonthCount, pending: pendingCount };
}

export default function AdminDashboard() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState("payments");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data?.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadPayments = useCallback(() => {
    setLoadingRows(true);
    supabase
      .from("payments")
      .select("id, client_type, status, screenshot_path, submitted_at, confirmed_at, tc_agreed_at, amount, transaction_ref, rejection_reason, source, clients(id, name, phone, age, height_cm, weight_kg, diet)")
      .order("submitted_at", { ascending: false })
      .then(({ data, error }) => {
        setLoadingRows(false);
        if (error) {
          console.error(error);
          setLoadError(true);
          return;
        }
        setLoadError(false);
        setRows(data || []);
      });
  }, []);

  useEffect(() => {
    if (!session) return;
    // Deferred a tick on purpose: loadPayments sets state as its very first
    // step, and calling a state-setting function synchronously inside an
    // effect body (rather than in response to an external event) is what
    // react-hooks/set-state-in-effect is warning against — this queues it
    // as a microtask instead, after this render has committed.
    queueMicrotask(loadPayments);
  }, [session, loadPayments]);

  if (session === undefined) return null;
  if (!session) return <LoginScreen />;

  const stats = computeStats(rows);

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="step-eyebrow">Ravi Fitness</p>
          <h2 className="display admin-title">Client &amp; Payment Tracker</h2>
        </div>
        <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>

      <div className="stat-grid">
        <div className="stat-card"><span className="stat-num">{loadingRows ? "–" : stats.clients}</span><span className="stat-label">Total clients</span></div>
        <div className="stat-card"><span className="stat-num">{loadingRows ? "–" : stats.thisMonth}</span><span className="stat-label">Payments this month</span></div>
        <div className="stat-card"><span className="stat-num">{loadingRows ? "–" : stats.pending}</span><span className="stat-label">Pending confirmation</span></div>
      </div>

      <div className="view-tabs">
        {[["payments", "Payments"], ["clients", "Clients"], ["renewals", "Renewals"]].map(([key, label]) => (
          <button key={key} className={"view-tab" + (view === key ? " active" : "")} onClick={() => setView(key)}>{label}</button>
        ))}
      </div>

      {loadingRows && <div className="table-wrap"><table className="payments-table"><tbody><tr><td className="loading-cell">Loading…</td></tr></tbody></table></div>}
      {!loadingRows && loadError && <div className="table-wrap"><table className="payments-table"><tbody><tr><td className="loading-cell">Couldn&apos;t load data — refresh to retry.</td></tr></tbody></table></div>}
      {!loadingRows && !loadError && view === "payments" && <PaymentsView rows={rows} onReload={loadPayments} />}
      {!loadingRows && !loadError && view === "clients" && <ClientsView rows={rows} onReload={loadPayments} />}
      {!loadingRows && !loadError && view === "renewals" && <RenewalsView rows={rows} />}
    </div>
  );
}
