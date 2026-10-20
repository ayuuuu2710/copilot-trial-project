import mongoose from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    age: { type: Number, min: 13, max: 100, default: null },
    sexForCalculation: { type: String, enum: ["female", "male", null], default: null },
    heightCm: { type: Number, min: 80, max: 250, default: null },
    currentWeightKg: { type: Number, min: 25, max: 350, default: null },
    fitnessGoal: {
      type: String,
      enum: ["lose_weight", "maintain", "gain_strength", "improve_fitness"],
      default: "improve_fitness",
    },
    activityLevel: {
      type: String,
      enum: ["sedentary", "light", "moderate", "very_active"],
      default: "moderate",
    },
    unitSystem: { type: String, enum: ["metric", "imperial"], default: "metric" },
    calorieTargetOverride: { type: Number, min: 500, max: 10000, default: null },
  },
  { timestamps: true },
);

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

const workoutSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true, index: true },
    kind: { type: String, enum: ["strength", "cardio"], required: true },
    exerciseName: { type: String, trim: true, maxlength: 100 },
    activityType: { type: String, trim: true, maxlength: 100 },
    sets: { type: Number, min: 1, max: 100 },
    repetitions: { type: Number, min: 1, max: 1000 },
    resistanceKg: { type: Number, min: 0, max: 1000 },
    durationMinutes: { type: Number, min: 1, max: 1440 },
    distanceKm: { type: Number, min: 0, max: 1000 },
    notes: { type: String, maxlength: 500, default: "" },
  },
  { timestamps: true },
);

const foodLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true, index: true },
    foodId: { type: String, required: true },
    foodName: { type: String, required: true, trim: true },
    meal: { type: String, enum: ["breakfast", "lunch", "dinner", "snack"], required: true },
    quantityGrams: { type: Number, required: true, min: 1, max: 10000 },
    nutrientsPer100g: {
      calories: { type: Number, required: true, min: 0 },
      protein: { type: Number, required: true, min: 0 },
      carbohydrates: { type: Number, required: true, min: 0 },
      fat: { type: Number, required: true, min: 0 },
    },
  },
  { timestamps: true },
);

const customFoodSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    calories: { type: Number, required: true, min: 0, max: 1000 },
    protein: { type: Number, required: true, min: 0, max: 1000 },
    carbohydrates: { type: Number, required: true, min: 0, max: 1000 },
    fat: { type: Number, required: true, min: 0, max: 1000 },
  },
  { timestamps: true },
);

const weightEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true, index: true },
    weightKg: { type: Number, required: true, min: 25, max: 350 },
    notes: { type: String, maxlength: 500, default: "" },
  },
  { timestamps: true },
);

const goalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    goalType: { type: String, enum: ["weight", "workouts", "calories", "custom"], required: true },
    targetValue: { type: Number, required: true, min: 0, max: 100000 },
    startValue: { type: Number, required: true, min: 0, max: 100000 },
    currentValue: { type: Number, min: 0, max: 100000, default: 0 },
    direction: { type: String, enum: ["up", "down"], required: true },
    unit: { type: String, required: true, trim: true, maxlength: 30 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const User = model("User", userSchema);
export const Session = model("Session", sessionSchema);
export const Workout = model("Workout", workoutSchema);
export const FoodLog = model("FoodLog", foodLogSchema);
export const CustomFood = model("CustomFood", customFoodSchema);
export const WeightEntry = model("WeightEntry", weightEntrySchema);
export const Goal = model("Goal", goalSchema);
