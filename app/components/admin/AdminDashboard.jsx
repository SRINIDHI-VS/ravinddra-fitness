"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import LoginScreen from "./LoginScreen";
import PaymentsView from "./PaymentsView";
import ClientsView from "./ClientsView";
import RenewalsView from "./RenewalsView";
import AttendanceView from "./AttendanceView";
import { ToastProvider } from "./Toast";
import { computeRenewals } from "@/app/lib/renewals";

function computeStats(rows, clientRows) {
  const now = new Date();
  let thisMonthCount = 0;
  let pendingCount = 0;
  let revenueThisMonth = 0;
  rows.forEach((r) => {
    if (r.status === "skipped") return; // not a real payment — doesn't count toward payment stats
    const d = new Date(r.submitted_at);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) thisMonthCount++;
    if (r.status === "submitted") pendingCount++;
    if (r.status === "confirmed" && r.amount != null && r.confirmed_at) {
      const cd = new Date(r.confirmed_at);
      if (cd.getFullYear() === now.getFullYear() && cd.getMonth() === now.getMonth()) revenueThisMonth += r.amount;
    }
  });
  return { clients: clientRows.length, thisMonth: thisMonthCount, pending: pendingCount, revenueThisMonth };
}

export default function AdminDashboard() {
  const [session, setSession] = useState(undefined);
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState("payments");
  const [sessionRows, setSessionRows] = useState([]);
  const [sessionsReady, setSessionsReady] = useState(false);
  const [clientRows, setClientRows] = useState([]);
  const [clientsReady, setClientsReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data?.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadPayments = useCallback(() => {
    setLoadingRows(true);
    supabase
      .from("payments")
      .select("id, client_type, status, screenshot_path, submitted_at, confirmed_at, tc_agreed_at, amount, transaction_ref, rejection_reason, source, clients(id, name, phone, age, height_cm, weight_kg, diet, archived, archived_at, last_reminded_at)")
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

  const loadClients = useCallback(() => {
    supabase
      .from("clients")
      .select("id, name, phone, age, height_cm, weight_kg, diet, medical_condition, fitness_goal, archived, archived_at, last_reminded_at")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        setClientsReady(true);
        if (error) {
          console.error(error);
          return;
        }
        setClientRows(data || []);
      });
  }, []);

  const reloadClientsAndPayments = useCallback(() => {
    loadPayments();
    loadClients();
  }, [loadPayments, loadClients]);

  useEffect(() => {
    if (!session) return;
    queueMicrotask(() => {
      loadPayments();
      loadSessions();
      loadClients();
    });
  }, [session, loadPayments, loadSessions, loadClients]);

  if (session === undefined) return null;
  if (!session) return <LoginScreen />;

  const stats = computeStats(rows, clientRows);
  const renewalsDue = computeRenewals(rows).filter((r) => r.status !== "ok").length;

  return (
    <ToastProvider>
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="step-eyebrow">Ravi Fitness</p>
          <h2 className="display admin-title">Client &amp; Payment Tracker</h2>
        </div>
        <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>

      <div className="stat-grid">
        <div className="stat-card"><span className="stat-num">{loadingRows || !clientsReady ? "–" : stats.clients}</span><span className="stat-label">Total clients</span></div>
        <div className="stat-card"><span className="stat-num">{loadingRows ? "–" : stats.thisMonth}</span><span className="stat-label">Payments this month</span></div>
        <div className="stat-card" title="Confirmed payments this month with an amount on file. Older confirmations logged without an amount aren't counted.">
          <span className="stat-num">{loadingRows ? "–" : "₹" + stats.revenueThisMonth.toLocaleString("en-IN")}</span>
          <span className="stat-label">Revenue this month</span>
        </div>
        <div className="stat-card"><span className="stat-num">{loadingRows ? "–" : stats.pending}</span><span className="stat-label">Pending confirmation</span></div>
      </div>

      <div className="view-tabs">
        {[["payments", "Payments"], ["clients", "Clients"], ["renewals", "Renewals"], ["attendance", "Attendance"]].map(([key, label]) => (
          <button key={key} className={"view-tab" + (view === key ? " active" : "")} onClick={() => setView(key)}>
            {label}
            {key === "renewals" && renewalsDue > 0 && <span className="tab-badge">{renewalsDue}</span>}
          </button>
        ))}
      </div>

      {loadingRows && <div className="table-wrap"><table className="payments-table"><tbody><tr><td className="loading-cell">Loading…</td></tr></tbody></table></div>}
      {!loadingRows && loadError && <div className="table-wrap"><table className="payments-table"><tbody><tr><td className="loading-cell">Couldn&apos;t load data — refresh to retry.</td></tr></tbody></table></div>}
      {!loadingRows && !loadError && view === "payments" && <PaymentsView rows={rows} clients={clientRows} onReload={reloadClientsAndPayments} />}
      {!loadingRows && !loadError && view === "clients" && !clientsReady && (
        <div className="table-wrap"><table className="payments-table"><tbody><tr><td className="loading-cell">Loading…</td></tr></tbody></table></div>
      )}
      {!loadingRows && !loadError && view === "clients" && clientsReady && (
        <ClientsView clients={clientRows} rows={rows} onReload={reloadClientsAndPayments} />
      )}
      {!loadingRows && !loadError && view === "renewals" && <RenewalsView rows={rows} onReload={loadPayments} />}
      {!loadingRows && !loadError && view === "attendance" && !sessionsReady && (
        <div className="table-wrap"><table className="payments-table"><tbody><tr><td className="loading-cell">Loading…</td></tr></tbody></table></div>
      )}
      {!loadingRows && !loadError && view === "attendance" && sessionsReady && (
        <AttendanceView rows={sessionRows} paymentRows={rows} clients={clientRows} onReload={loadSessions} />
      )}
    </div>
    </ToastProvider>
  );
}
