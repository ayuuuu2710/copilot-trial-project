export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new CustomEvent("fitbuddy:session-expired"));
    }
    const error = new Error(payload?.error ?? "We couldn't complete that request. Please try again.");
    error.status = response.status;
    error.details = payload?.details ?? [];
    throw error;
  }
  return payload;
}

export function notify(message, action) {
  window.dispatchEvent(new CustomEvent("fitbuddy:toast", { detail: { message, action } }));
}

export function localDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const toKg = (value, units) => Number(value) / (units === "imperial" ? 2.2046226218 : 1);
export const fromKg = (value, units) => value == null ? "" : Number((value * (units === "imperial" ? 2.2046226218 : 1)).toFixed(1));
export const toCm = (value, units) => Number(value) * (units === "imperial" ? 2.54 : 1);
export const fromCm = (value, units) => value == null ? "" : Number((value / (units === "imperial" ? 2.54 : 1)).toFixed(1));
export const toKm = (value, units) => Number(value) * (units === "imperial" ? 1.609344 : 1);
export const fromKm = (value, units) => value == null ? "" : Number((value / (units === "imperial" ? 1.609344 : 1)).toFixed(2));
export const displayWeightUnit = (units) => units === "imperial" ? "lb" : "kg";
export const displayDistanceUnit = (units) => units === "imperial" ? "mi" : "km";
