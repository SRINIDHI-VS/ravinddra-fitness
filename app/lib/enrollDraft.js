"use client";

const STORAGE_KEY = "raviEnroll:draft:v1";

const FIELDS = [
  "clientType", "posInPath",
  "name", "phone", "age", "height", "weight", "diet",
  "nameEx", "phoneEx", "existingName", "existingPaymentCount", "existingLastAmount",
  "agreed", "unlocked", "tcAgreedAt", "agreedName", "agreedPhone", "amount",
];

export function loadDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.clientType) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(data) {
  if (typeof window === "undefined") return;
  try {
    const toSave = {};
    FIELDS.forEach((k) => { toSave[k] = data[k]; });
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
  }
}
