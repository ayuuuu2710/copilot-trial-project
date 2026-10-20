export const ACTIVITY_MULTIPLIERS = Object.freeze({
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
});

export function estimateDailyCalories(profile) {
  const { age, sexForCalculation, heightCm, currentWeightKg, activityLevel } = profile;
  if (
    !Number.isFinite(age) || age < 18 || age > 100 ||
    !Number.isFinite(heightCm) || heightCm < 80 || heightCm > 250 ||
    !Number.isFinite(currentWeightKg) || currentWeightKg < 25 || currentWeightKg > 350 ||
    !sexForCalculation || !ACTIVITY_MULTIPLIERS[activityLevel]
  ) {
    return null;
  }
  const sexAdjustment = sexForCalculation === "male" ? 5 : -161;
  const bmr = 10 * currentWeightKg + 6.25 * heightCm - 5 * age + sexAdjustment;
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

export function calculateBmi(weightKg, heightCm) {
  if (
    !Number.isFinite(weightKg) || weightKg < 25 || weightKg > 350 ||
    !Number.isFinite(heightCm) || heightCm < 80 || heightCm > 250
  ) {
    return null;
  }
  return Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10;
}

export function scaleNutrients(nutrients, quantityGrams) {
  const scale = quantityGrams / 100;
  return Object.fromEntries(
    Object.entries(nutrients).map(([key, value]) => [key, Math.round(value * scale * 10) / 10]),
  );
}

export function getGoalProgress(goal, currentValue) {
  const { startValue, targetValue, direction } = goal;
  const complete = direction === "up" ? currentValue >= targetValue : currentValue <= targetValue;
  const range = direction === "up" ? targetValue - startValue : startValue - targetValue;
  const progress = range <= 0
    ? (complete ? 100 : 0)
    : Math.max(0, Math.min(100, ((direction === "up" ? currentValue - startValue : startValue - currentValue) / range) * 100));
  return { currentValue, progress: Math.round(progress), complete };
}

export function dateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function dayWindow(dateString, days) {
  const end = dateOnly(dateString);
  if (!end) return null;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const afterEnd = new Date(end);
  afterEnd.setUTCDate(afterEnd.getUTCDate() + 1);
  return { start, end: afterEnd };
}

export function calendarWeekWindow(dateString) {
  const currentDay = dateOnly(dateString);
  if (!currentDay) return null;
  const start = new Date(currentDay);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return { start, end: new Date(currentDay.getTime() + 24 * 60 * 60 * 1000) };
}
