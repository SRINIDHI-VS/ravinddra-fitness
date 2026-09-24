"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import LoginScreen from "./LoginScreen";
import PaymentsView from "./PaymentsView";
import ClientsView from "./ClientsView";
import RenewalsView from "./RenewalsView";
import AttendanceView from "./AttendanceView";

function computeStats(rows) {
  const uniqueClients = new Set();
  const now = new Date();
  let thisMonthCount = 0;
  let pendingCount = 0;
  let revenueThisMonth = 0;
  rows.forEach((r) => {
    if (r.clients) uniqueClients.add(r.clients.id);
    const d = new Date(r.submitted_at);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) thisMonthCount++;
    if (r.status === "submitted") pendingCount++;
    if (r.status === "confirmed" && r.amount != null && r.confirmed_at) {
      const cd = new Date(r.confirmed_at);
      if (cd.getFullYear() === now.getFullYear() && cd.getMonth() === now.getMonth()) revenueThisMonth += r.amount;
    }
  });
  return { clients: uniqueClients.size, thisMonth: thisMonthCount, pending: pendingCount, revenueThisMonth };
}

export default function AdminDashboard() {
  const [session, setSession] = useState(undefined);
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState("payments");
  const [sessionRows, setSessionRows] = useState([]);
  const [sessionsReady, setSessionsReady] = useState(false);

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

  const loadSessions = useCallback(() => {
    supabase
      .from("class_sessions")
      .select("id, client_id, class_date, status, notes, created_at, clients(id, name, phone)")
      .order("class_date", { ascending: false })
      .then(({ data, error }) => {
        setSessionsReady(true);
        if (error) {
          console.error(error);
          return;
        }
        setSessionRows(data || []);
      });
  }, []);

  useEffect(() => {
    if (!session) return;
    queueMicrotask(() => {
      loadPayments();
      loadSessions();
    });
  }, [session, loadPayments, loadSessions]);

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
        <div className="stat-card" title="Confirmed payments this month with an amount on file. Older confirmations logged without an amount aren't counted.">
          <span className="stat-num">{loadingRows ? "–" : "₹" + stats.revenueThisMonth.toLocaleString("en-IN")}</span>
          <span className="stat-label">Revenue this month</span>
        </div>
        <div className="stat-card"><span className="stat-num">{loadingRows ? "–" : stats.pending}</span><span className="stat-label">Pending confirmation</span></div>
      </div>

      <div className="view-tabs">
        {[["payments", "Payments"], ["clients", "Clients"], ["renewals", "Renewals"], ["attendance", "Attendance"]].map(([key, label]) => (
          <button key={key} className={"view-tab" + (view === key ? " active" : "")} onClick={() => setView(key)}>{label}</button>
        ))}
      </div>

      {loadingRows && <div className="table-wrap"><table className="payments-table"><tbody><tr><td className="loading-cell">Loading…</td></tr></tbody></table></div>}
      {!loadingRows && loadError && <div className="table-wrap"><table className="payments-table"><tbody><tr><td className="loading-cell">Couldn&apos;t load data — refresh to retry.</td></tr></tbody></table></div>}
      {!loadingRows && !loadError && view === "payments" && <PaymentsView rows={rows} onReload={loadPayments} />}
      {!loadingRows && !loadError && view === "clients" && <ClientsView rows={rows} onReload={loadPayments} />}
      {!loadingRows && !loadError && view === "renewals" && <RenewalsView rows={rows} />}
      {!loadingRows && !loadError && view === "attendance" && !sessionsReady && (
        <div className="table-wrap"><table className="payments-table"><tbody><tr><td className="loading-cell">Loading…</td></tr></tbody></table></div>
      )}
      {!loadingRows && !loadError && view === "attendance" && sessionsReady && (
        <AttendanceView rows={sessionRows} paymentRows={rows} onReload={loadSessions} />
      )}
    </div>
  );
}
