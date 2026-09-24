"use client";

import { useMemo, useState } from "react";
import { computeRenewals } from "@/app/lib/renewals";
import { STATUS_META } from "./AttendanceView";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dateKey(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), outside: false });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    cells.push({ date: next, outside: true });
  }
  return cells;
}

function formatFullDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function AttendanceCalendar({ sessions, paymentRows, onDeleteSession, onRequestLogSession }) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);

  const sessionsByDate = useMemo(() => {
    const map = {};
    sessions.forEach((s) => {
      if (!map[s.class_date]) map[s.class_date] = [];
      map[s.class_date].push(s);
    });
    return map;
  }, [sessions]);

  const paymentsByDate = useMemo(() => {
    const map = {};
    paymentRows.forEach((p) => {
      if (p.status !== "confirmed" || !p.confirmed_at) return;
      const key = dateKey(new Date(p.confirmed_at));
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [paymentRows]);

  const dueByDate = useMemo(() => {
    const map = {};
    computeRenewals(paymentRows).forEach((r) => {
      const key = dateKey(r.nextDue);
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [paymentRows]);

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const todayKey = dateKey(today);

  function goPrevMonth() {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }

  function goNextMonth() {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }

  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(todayKey);
  }

  const daySessions = selectedDate ? sessionsByDate[selectedDate] || [] : [];
  const dayPayments = selectedDate ? paymentsByDate[selectedDate] || [] : [];
  const dayDue = selectedDate ? dueByDate[selectedDate] || [] : [];

  return (
    <div>
      <div className="cal-toolbar">
        <button type="button" className="row-btn" onClick={goPrevMonth}>← Prev</button>
        <span className="cal-month-label">{MONTH_LABELS[viewMonth]} {viewYear}</span>
        <button type="button" className="row-btn" onClick={goNextMonth}>Next →</button>
        <button type="button" className="row-btn" onClick={goToday}>Today</button>
      </div>

      <div className="cal-grid cal-grid-head">
        {WEEKDAY_LABELS.map((w) => <div key={w} className="cal-weekday">{w}</div>)}
      </div>

      <div className="cal-grid">
        {cells.map(({ date, outside }) => {
          const key = dateKey(date);
          const daySess = sessionsByDate[key] || [];
          const dayPaid = paymentsByDate[key] || [];
          const dayDueList = dueByDate[key] || [];
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const dots = daySess.slice(0, 4).map((s) => STATUS_META[s.status]?.badge || "badge-type");
          return (
            <button
              type="button"
              key={key}
              className={"cal-day" + (outside ? " outside" : "") + (isToday ? " today" : "") + (isSelected ? " selected" : "")}
              onClick={() => setSelectedDate(key)}
              title={daySess.length || dayPaid.length || dayDueList.length ? `${daySess.length} session(s), ${dayPaid.length} payment(s), ${dayDueList.length} due` : undefined}
            >
              <span className="cal-day-num">{date.getDate()}</span>
              {dots.length > 0 && (
                <span className="cal-day-dots">
                  {dots.map((cls, i) => <span key={i} className={"cal-dot cal-dot-" + cls} />)}
                  {daySess.length > 4 && <span className="cal-dot-more">+{daySess.length - 4}</span>}
                </span>
              )}
              {(dayPaid.length > 0 || dayDueList.length > 0) && (
                <span className="cal-day-money">
                  {dayPaid.length > 0 && <span className="cal-money-paid">₹{dayPaid.length > 1 ? dayPaid.length : ""}</span>}
                  {dayDueList.length > 0 && <span className="cal-money-due">●{dayDueList.length > 1 ? dayDueList.length : ""}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="cal-legend">
        <span><span className="cal-dot cal-dot-badge-confirmed" /> Completed / makeup</span>
        <span><span className="cal-dot cal-dot-badge-pending" /> Cancelled</span>
        <span><span className="cal-dot cal-dot-badge-rejected" /> No-show</span>
        <span><span className="cal-money-paid">₹</span> Payment confirmed</span>
        <span><span className="cal-money-due">●</span> Renewal due (est.)</span>
      </div>

      {selectedDate && (
        <div className="cal-detail">
          <div className="cal-detail-header">
            <h4>{formatFullDate(selectedDate)}</h4>
            <button type="button" className="row-btn" onClick={() => onRequestLogSession(selectedDate)}>+ Log session</button>
          </div>

          {daySessions.length === 0 && dayPayments.length === 0 && dayDue.length === 0 && (
            <p className="cell-sub">Nothing on this day.</p>
          )}

          {daySessions.length > 0 && (
            <div className="cal-detail-group">
              <p className="cal-detail-label">Sessions</p>
              {daySessions.map((s) => {
                const meta = STATUS_META[s.status] || { label: s.status, badge: "badge-type" };
                return (
                  <div key={s.id} className="cal-detail-row">
                    <span className="cell-name">{s.clients?.name || "—"}</span>
                    <span className={"badge " + meta.badge}>{meta.label}</span>
                    <button type="button" className="row-btn reject-btn" onClick={() => onDeleteSession(s.id)}>Delete</button>
                  </div>
                );
              })}
            </div>
          )}

          {dayPayments.length > 0 && (
            <div className="cal-detail-group">
              <p className="cal-detail-label">Payments confirmed</p>
              {dayPayments.map((p) => (
                <div key={p.id} className="cal-detail-row">
                  <span className="cell-name">{p.clients?.name || "—"}</span>
                  <span className="cell-sub">{p.amount != null ? "₹" + p.amount : "—"}</span>
                </div>
              ))}
            </div>
          )}

          {dayDue.length > 0 && (
            <div className="cal-detail-group">
              <p className="cal-detail-label">Renewals due (est.)</p>
              {dayDue.map((r) => (
                <div key={r.id} className="cal-detail-row">
                  <span className="cell-name">{r.name}</span>
                  <span className="cell-sub">{r.phone}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
