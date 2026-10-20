import test from "node:test";
import assert from "node:assert/strict";
import { calculateBmi, calendarWeekWindow, estimateDailyCalories, getGoalProgress, scaleNutrients } from "../src/calculations.js";
import { starterFoods } from "../src/foods.js";

test("BMI uses kilograms and centimeters and rejects missing or implausible measurements", () => {
  assert.equal(calculateBmi(70, 170), 24.2);
  assert.equal(calculateBmi(null, 170), null);
  assert.equal(calculateBmi(10, 170), null);
});

test("Mifflin–St Jeor estimate applies activity multiplier and withholds age-sensitive estimates", () => {
  const profile = { age: 30, sexForCalculation: "female", heightCm: 170, currentWeightKg: 70, activityLevel: "moderate" };
  assert.equal(estimateDailyCalories(profile), 2250);
  assert.equal(estimateDailyCalories({ ...profile, age: 17 }), null);
  assert.equal(estimateDailyCalories({ ...profile, sexForCalculation: null }), null);
});

test("nutrients scale from the 100 g reference serving", () => {
  assert.deepEqual(scaleNutrients({ calories: 89, protein: 1.1, carbohydrates: 22.8, fat: 0.3 }, 200), {
    calories: 178, protein: 2.2, carbohydrates: 45.6, fat: 0.6,
  });
});

test("goal completion is capped and treats overshooting as complete", () => {
  assert.deepEqual(getGoalProgress({ startValue: 0, targetValue: 10, direction: "up" }, 14), {
    currentValue: 14, progress: 100, complete: true,
  });
  assert.equal(getGoalProgress({ startValue: 80, targetValue: 70, direction: "down" }, 75).progress, 50);
});

test("calendar-week window starts Monday and ends after the selected day", () => {
  const { start, end } = calendarWeekWindow("2026-10-18");
  assert.equal(start.toISOString().slice(0, 10), "2026-10-12");
  assert.equal(end.toISOString().slice(0, 10), "2026-10-19");
});

test("starter foods contain at least 50 entries with explicit 100 g values", () => {
  assert.ok(starterFoods.length >= 50);
  assert.ok(starterFoods.every((food) => food.servingSize === 100 && food.servingUnit === "g" && food.sourceLabel.includes("Approximate")));
});
