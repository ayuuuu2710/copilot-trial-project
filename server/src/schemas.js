import { z } from "zod";
import { dateOnly } from "./calculations.js";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => Boolean(dateOnly(value)), "Enter a valid calendar date.");
const note = z.string().max(500).optional().default("");
const number = (min, max) => z.number().finite().min(min).max(max);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10).max(128),
}).strict();

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
}).strict();

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  age: number(13, 100).nullable().optional(),
  sexForCalculation: z.enum(["female", "male"]).nullable().optional(),
  heightCm: number(80, 250).nullable().optional(),
  currentWeightKg: number(25, 350).nullable().optional(),
  fitnessGoal: z.enum(["lose_weight", "maintain", "gain_strength", "improve_fitness"]).optional(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "very_active"]).optional(),
  unitSystem: z.enum(["metric", "imperial"]).optional(),
  calorieTargetOverride: number(500, 10000).nullable().optional(),
}).strict();

export const workoutSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("strength"),
    date: day,
    exerciseName: z.string().trim().min(1).max(100),
    sets: number(1, 100).int(),
    repetitions: number(1, 1000).int(),
    resistanceKg: number(0, 1000).optional(),
    notes: note,
  }).strict(),
  z.object({
    kind: z.literal("cardio"),
    date: day,
    activityType: z.string().trim().min(1).max(100),
    durationMinutes: number(1, 1440).int(),
    distanceKm: number(0, 1000).optional(),
    notes: note,
  }).strict(),
]);

export const customFoodSchema = z.object({
  name: z.string().trim().min(1).max(100),
  calories: number(0, 1000),
  protein: number(0, 1000),
  carbohydrates: number(0, 1000),
  fat: number(0, 1000),
}).strict();

export const foodLogSchema = z.object({
  foodId: z.string().min(1).max(100),
  date: day,
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  quantityGrams: number(1, 10000),
}).strict();

export const foodLogRestoreSchema = z.object({
  foodId: z.string().min(1).max(100),
  foodName: z.string().trim().min(1).max(100),
  date: day,
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  quantityGrams: number(1, 10000),
  nutrientsPer100g: z.object({
    calories: number(0, 1000),
    protein: number(0, 1000),
    carbohydrates: number(0, 1000),
    fat: number(0, 1000),
  }).strict(),
}).strict();

export const weightSchema = z.object({
  date: day,
  weightKg: number(25, 350),
  notes: note,
}).strict();

export const goalSchema = z.object({
  title: z.string().trim().min(1).max(100),
  goalType: z.enum(["weight", "workouts", "calories", "custom"]),
  targetValue: number(0, 100000),
  startValue: number(0, 100000),
  currentValue: number(0, 100000).optional().default(0),
  direction: z.enum(["up", "down"]),
  unit: z.string().trim().min(1).max(30),
  active: z.boolean().optional().default(true),
}).strict().superRefine((goal, context) => {
  if (goal.goalType === "weight" && goal.unit !== "kg") {
    context.addIssue({ code: "custom", path: ["unit"], message: "Weight goals must use kilograms internally." });
  }
  if (goal.goalType === "workouts" && goal.unit !== "workouts") {
    context.addIssue({ code: "custom", path: ["unit"], message: "Workout goals must use workout counts." });
  }
  if (goal.goalType === "calories" && goal.unit !== "kcal") {
    context.addIssue({ code: "custom", path: ["unit"], message: "Calorie goals must use kcal." });
  }
});

export function publicProfile(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    age: user.age,
    sexForCalculation: user.sexForCalculation,
    heightCm: user.heightCm,
    currentWeightKg: user.currentWeightKg,
    fitnessGoal: user.fitnessGoal,
    activityLevel: user.activityLevel,
    unitSystem: user.unitSystem,
    calorieTargetOverride: user.calorieTargetOverride,
  };
}
