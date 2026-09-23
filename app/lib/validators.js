// Shared between the browser form (app/components/enroll/EnrollForm.jsx) and the
// server route (app/api/submit-enrollment/route.js) on purpose: the old vanilla-JS
// version had two separate copies of these rules that drifted apart, and the server
// copy was missing several checks entirely — anyone could POST straight to the
// function URL with an out-of-range age or an unvalidated name. One shared file
// means the browser and the server can never disagree about what's valid again.

export const NAME_RE = /^[A-Za-z][A-Za-z .'-]{1,99}$/;
export const PHONE_RE = /^[6-9]\d{9}$/;
export const DIET_VALUES = ["Veg", "Non-veg"];
export const CLIENT_TYPES = ["New", "Existing"];

export const RANGES = {
  age: { min: 10, max: 90 },
  height_cm: { min: 100, max: 230 },
  weight_kg: { min: 25, max: 250 },
};

export function isValidName(v) {
  return NAME_RE.test((v ?? "").trim());
}

export function isValidPhone(v) {
  return PHONE_RE.test((v ?? "").trim());
}

export function isInRange(v, key) {
  if (v === "" || v === null || v === undefined) return false;
  const n = Number(v);
  const { min, max } = RANGES[key];
  return Number.isFinite(n) && n >= min && n <= max;
}

export function isValidDiet(v) {
  return DIET_VALUES.includes(v);
}

export function isValidClientType(v) {
  return CLIENT_TYPES.includes(v);
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/webp"];
