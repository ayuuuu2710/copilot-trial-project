import { Router } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { CustomFood, FoodLog, Goal, Session, User, WeightEntry, Workout } from "./models.js";
import { calculateBmi, calendarWeekWindow, dateOnly, dayWindow, estimateDailyCalories, getGoalProgress, scaleNutrients } from "./calculations.js";
import { starterFoods } from "./foods.js";
import { asyncRoute, authenticate, validate } from "./middleware.js";
import { customFoodSchema, deleteAccountSchema, foodLogRestoreSchema, foodLogSchema, goalSchema, profileSchema, publicProfile, weightSchema, workoutSchema } from "./schemas.js";

const router = Router();
router.use(authenticate);

router.get("/account/export", asyncRoute(async (request, response) => {
  const userId = request.user._id;
  const [workouts, foodLogs, customFoods, weightEntries, goals] = await Promise.all([
    Workout.find({ userId }).sort({ date: 1, createdAt: 1 }).lean(),
    FoodLog.find({ userId }).sort({ date: 1, createdAt: 1 }).lean(),
    CustomFood.find({ userId }).sort({ createdAt: 1 }).lean(),
    WeightEntry.find({ userId }).sort({ date: 1, createdAt: 1 }).lean(),
    Goal.find({ userId }).sort({ createdAt: 1 }).lean(),
  ]);
  const exportDate = new Date().toISOString().slice(0, 10);
  response.set("Content-Disposition", `attachment; filename="fitbuddy-data-${exportDate}.json"`);
  response.json({
    exportedAt: new Date().toISOString(),
    app: "FitBuddy",
    profile: publicProfile(request.user),
    workouts,
    foodLogs,
    customFoods,
    weightEntries,
    goals,
  });
}));

router.delete("/account", validate(deleteAccountSchema), asyncRoute(async (request, response) => {
  const user = await User.findById(request.user._id).select("+passwordHash");
  const passwordMatches = user && await bcrypt.compare(request.validatedBody.password, user.passwordHash);
  if (!passwordMatches) return response.status(401).json({ error: "Your password is incorrect." });

  const userId = user._id;
  await Promise.all([
    Workout.deleteMany({ userId }),
    FoodLog.deleteMany({ userId }),
    CustomFood.deleteMany({ userId }),
    WeightEntry.deleteMany({ userId }),
    Goal.deleteMany({ userId }),
    Session.deleteMany({ userId }),
  ]);
  await User.deleteOne({ _id: userId });
  response.clearCookie("fitbuddy_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  response.json({ message: "Your FitBuddy account and its data have been deleted." });
}));

function ownedId(request) {
  return mongoose.isValidObjectId(request.params.id) ? request.params.id : null;
}

function toDate(value) {
  return dateOnly(value);
}

function dateString(value) {
  return value.toISOString().slice(0, 10);
}

async function ownedRecord(model, id, userId) {
  if (!mongoose.isValidObjectId(id)) return null;
  return model.findOne({ _id: id, userId });
}

async function syncProfileWeight(userId) {
  const latest = await WeightEntry.findOne({ userId }).sort({ date: -1, createdAt: -1 });
  await User.updateOne({ _id: userId }, { currentWeightKg: latest?.weightKg ?? null });
}

function serializeCustomFood(food) {
  return {
    id: String(food._id),
    name: food.name,
    calories: food.calories,
    protein: food.protein,
    carbohydrates: food.carbohydrates,
    fat: food.fat,
    servingSize: 100,
    servingUnit: "g",
    sourceLabel: "Your custom food; values entered per 100 g",
    isCustom: true,
  };
}

async function findFood(id, userId) {
  const builtin = starterFoods.find((food) => food.id === id);
  if (builtin) return builtin;
  const custom = await ownedRecord(CustomFood, id, userId);
  return custom ? serializeCustomFood(custom) : null;
}

router.get("/profile", (request, response) => {
  const profile = publicProfile(request.user);
  response.json({
    profile,
    estimatedDailyCalories: estimateDailyCalories(request.user),
    effectiveDailyCalories: request.user.calorieTargetOverride ?? estimateDailyCalories(request.user),
  });
});

router.put("/profile", validate(profileSchema), asyncRoute(async (request, response) => {
  const changes = request.validatedBody;
  const weightEntry = await WeightEntry.findOne({ userId: request.user._id });
  if (weightEntry && Object.hasOwn(changes, "currentWeightKg")) {
    const latest = await WeightEntry.findOne({ userId: request.user._id }).sort({ date: -1, createdAt: -1 });
    changes.currentWeightKg = latest.weightKg;
  }
  const updated = await User.findByIdAndUpdate(request.user._id, { $set: changes }, { new: true, runValidators: true });
  response.json({
    profile: publicProfile(updated),
    estimatedDailyCalories: estimateDailyCalories(updated),
    effectiveDailyCalories: updated.calorieTargetOverride ?? estimateDailyCalories(updated),
  });
}));

router.get("/workouts", asyncRoute(async (request, response) => {
  const query = { userId: request.user._id };
  if (request.query.date) {
    const start = dateOnly(request.query.date);
    if (!start) return response.status(400).json({ error: "Date must use YYYY-MM-DD format." });
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    query.date = { $gte: start, $lt: end };
  }
  const records = await Workout.find(query).sort({ date: -1, createdAt: -1 }).limit(500);
  response.json({ workouts: records });
}));

router.post("/workouts", validate(workoutSchema), asyncRoute(async (request, response) => {
  const body = request.validatedBody;
  const workout = await Workout.create({ ...body, date: toDate(body.date), userId: request.user._id });
  response.status(201).json({ workout });
}));

router.put("/workouts/:id", validate(workoutSchema), asyncRoute(async (request, response) => {
  const id = ownedId(request);
  if (!id) return response.status(404).json({ error: "Workout not found." });
  const body = request.validatedBody;
  const workout = await Workout.findOneAndUpdate(
    { _id: id, userId: request.user._id },
    { ...body, date: toDate(body.date) },
    { new: true, runValidators: true },
  );
  if (!workout) return response.status(404).json({ error: "Workout not found." });
  response.json({ workout });
}));

router.delete("/workouts/:id", asyncRoute(async (request, response) => {
  const id = ownedId(request);
  const deleted = id && await Workout.findOneAndDelete({ _id: id, userId: request.user._id });
  if (!deleted) return response.status(404).json({ error: "Workout not found." });
  response.json({ message: "Workout deleted." });
}));

router.get("/foods", asyncRoute(async (request, response) => {
  const search = typeof request.query.search === "string" ? request.query.search.trim().toLowerCase().slice(0, 80) : "";
  const builtins = starterFoods.filter((food) => food.name.toLowerCase().includes(search));
  const custom = await CustomFood.find({
    userId: request.user._id,
    ...(search ? { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } } : {}),
  }).sort({ name: 1 }).limit(50);
  response.json({ foods: [...builtins, ...custom.map(serializeCustomFood)].slice(0, 100) });
}));

router.get("/foods/custom", asyncRoute(async (request, response) => {
  const foods = await CustomFood.find({ userId: request.user._id }).sort({ name: 1 });
  response.json({ foods: foods.map(serializeCustomFood) });
}));

router.get("/foods/custom/:id", asyncRoute(async (request, response) => {
  const food = await ownedRecord(CustomFood, request.params.id, request.user._id);
  if (!food) return response.status(404).json({ error: "Custom food not found." });
  response.json({ food: serializeCustomFood(food) });
}));

router.post("/foods/custom", validate(customFoodSchema), asyncRoute(async (request, response) => {
  const food = await CustomFood.create({ ...request.validatedBody, userId: request.user._id });
  response.status(201).json({ food: serializeCustomFood(food) });
}));

router.put("/foods/custom/:id", validate(customFoodSchema), asyncRoute(async (request, response) => {
  const id = ownedId(request);
  if (!id) return response.status(404).json({ error: "Custom food not found." });
  const food = await CustomFood.findOneAndUpdate(
    { _id: id, userId: request.user._id },
    request.validatedBody,
    { new: true, runValidators: true },
  );
  if (!food) return response.status(404).json({ error: "Custom food not found." });
  response.json({ food: serializeCustomFood(food) });
}));

router.delete("/foods/custom/:id", asyncRoute(async (request, response) => {
  const id = ownedId(request);
  const deleted = id && await CustomFood.findOneAndDelete({ _id: id, userId: request.user._id });
  if (!deleted) return response.status(404).json({ error: "Custom food not found." });
  response.json({ message: "Custom food deleted. Existing logs retain their nutrition snapshot." });
}));

router.get("/food-logs", asyncRoute(async (request, response) => {
  const query = { userId: request.user._id };
  if (request.query.date) {
    const start = dateOnly(request.query.date);
    if (!start) return response.status(400).json({ error: "Date must use YYYY-MM-DD format." });
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    query.date = { $gte: start, $lt: end };
  }
  const logs = await FoodLog.find(query).sort({ date: -1, createdAt: -1 }).limit(500);
  response.json({
    foodLogs: logs.map((entry) => ({
      ...entry.toObject(),
      nutrients: scaleNutrients(entry.nutrientsPer100g, entry.quantityGrams),
    })),
  });
}));

router.post("/food-logs", validate(foodLogSchema), asyncRoute(async (request, response) => {
  const body = request.validatedBody;
  const food = await findFood(body.foodId, request.user._id);
  if (!food) return response.status(400).json({ error: "That food is unavailable. Choose another food and try again." });
  const log = await FoodLog.create({
    ...body,
    date: toDate(body.date),
    userId: request.user._id,
    foodName: food.name,
    nutrientsPer100g: {
      calories: food.calories,
      protein: food.protein,
      carbohydrates: food.carbohydrates,
      fat: food.fat,
    },
  });
  response.status(201).json({
    foodLog: { ...log.toObject(), nutrients: scaleNutrients(log.nutrientsPer100g, log.quantityGrams) },
  });
}));

router.post("/food-logs/restore", validate(foodLogRestoreSchema), asyncRoute(async (request, response) => {
  const body = request.validatedBody;
  const log = await FoodLog.create({
    ...body,
    date: toDate(body.date),
    userId: request.user._id,
  });
  response.status(201).json({
    foodLog: { ...log.toObject(), nutrients: scaleNutrients(log.nutrientsPer100g, log.quantityGrams) },
  });
}));

router.put("/food-logs/:id", validate(foodLogSchema), asyncRoute(async (request, response) => {
  const id = ownedId(request);
  if (!id) return response.status(404).json({ error: "Food log not found." });
  const body = request.validatedBody;
  const food = await findFood(body.foodId, request.user._id);
  if (!food) return response.status(400).json({ error: "That food is unavailable. Choose another food and try again." });
  const log = await FoodLog.findOneAndUpdate(
    { _id: id, userId: request.user._id },
    {
      ...body,
      date: toDate(body.date),
      foodName: food.name,
      nutrientsPer100g: {
        calories: food.calories,
        protein: food.protein,
        carbohydrates: food.carbohydrates,
        fat: food.fat,
      },
    },
    { new: true, runValidators: true },
  );
  if (!log) return response.status(404).json({ error: "Food log not found." });
  response.json({ foodLog: { ...log.toObject(), nutrients: scaleNutrients(log.nutrientsPer100g, log.quantityGrams) } });
}));

router.delete("/food-logs/:id", asyncRoute(async (request, response) => {
  const id = ownedId(request);
  const deleted = id && await FoodLog.findOneAndDelete({ _id: id, userId: request.user._id });
  if (!deleted) return response.status(404).json({ error: "Food log not found." });
  response.json({ message: "Food log deleted." });
}));

router.get("/weights", asyncRoute(async (request, response) => {
  const entries = await WeightEntry.find({ userId: request.user._id }).sort({ date: -1, createdAt: -1 }).limit(500);
  response.json({ weightEntries: entries });
}));

router.post("/weights", validate(weightSchema), asyncRoute(async (request, response) => {
  const body = request.validatedBody;
  const entry = await WeightEntry.create({ ...body, date: toDate(body.date), userId: request.user._id });
  await syncProfileWeight(request.user._id);
  response.status(201).json({ weightEntry: entry });
}));

router.put("/weights/:id", validate(weightSchema), asyncRoute(async (request, response) => {
  const id = ownedId(request);
  if (!id) return response.status(404).json({ error: "Weight entry not found." });
  const body = request.validatedBody;
  const entry = await WeightEntry.findOneAndUpdate(
    { _id: id, userId: request.user._id },
    { ...body, date: toDate(body.date) },
    { new: true, runValidators: true },
  );
  if (!entry) return response.status(404).json({ error: "Weight entry not found." });
  await syncProfileWeight(request.user._id);
  response.json({ weightEntry: entry });
}));

router.delete("/weights/:id", asyncRoute(async (request, response) => {
  const id = ownedId(request);
  const deleted = id && await WeightEntry.findOneAndDelete({ _id: id, userId: request.user._id });
  if (!deleted) return response.status(404).json({ error: "Weight entry not found." });
  await syncProfileWeight(request.user._id);
  response.json({ message: "Weight entry deleted." });
}));

router.get("/goals", asyncRoute(async (request, response) => {
  const goals = await Goal.find({ userId: request.user._id }).sort({ active: -1, createdAt: -1 });
  response.json({ goals });
}));

router.post("/goals", validate(goalSchema), asyncRoute(async (request, response) => {
  const goal = await Goal.create({ ...request.validatedBody, userId: request.user._id });
  response.status(201).json({ goal });
}));

router.put("/goals/:id", validate(goalSchema), asyncRoute(async (request, response) => {
  const id = ownedId(request);
  if (!id) return response.status(404).json({ error: "Goal not found." });
  const goal = await Goal.findOneAndUpdate(
    { _id: id, userId: request.user._id },
    request.validatedBody,
    { new: true, runValidators: true },
  );
  if (!goal) return response.status(404).json({ error: "Goal not found." });
  response.json({ goal });
}));

router.delete("/goals/:id", asyncRoute(async (request, response) => {
  const id = ownedId(request);
  const deleted = id && await Goal.findOneAndDelete({ _id: id, userId: request.user._id });
  if (!deleted) return response.status(404).json({ error: "Goal not found." });
  response.json({ message: "Goal deleted." });
}));

router.get("/dashboard", asyncRoute(async (request, response) => {
  const selectedDate = typeof request.query.date === "string" ? request.query.date : dateString(new Date());
  const day = dayWindow(selectedDate, 1);
  const week = calendarWeekWindow(selectedDate);
  const month = dayWindow(selectedDate, 30);
  if (!day || !week || !month) return response.status(400).json({ error: "Date must use YYYY-MM-DD format." });

  const [dayWorkouts, dayLogs, recentWeights, latestWeight, activeGoals, weekWorkouts] = await Promise.all([
    Workout.find({ userId: request.user._id, date: { $gte: day.start, $lt: day.end } }).sort({ createdAt: 1 }),
    FoodLog.find({ userId: request.user._id, date: { $gte: day.start, $lt: day.end } }),
    WeightEntry.find({ userId: request.user._id, date: { $gte: month.start, $lt: day.end } }).sort({ date: 1, createdAt: 1 }),
    WeightEntry.findOne({ userId: request.user._id }).sort({ date: -1, createdAt: -1 }),
    Goal.find({ userId: request.user._id, active: true }),
    Workout.countDocuments({ userId: request.user._id, date: { $gte: week.start, $lt: day.end } }),
  ]);

  const totals = dayLogs.reduce((result, log) => {
    const nutrients = scaleNutrients(log.nutrientsPer100g, log.quantityGrams);
    for (const key of Object.keys(result)) result[key] += nutrients[key];
    return result;
  }, { calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  for (const key of Object.keys(totals)) totals[key] = Math.round(totals[key] * 10) / 10;

  const weightByDay = new Map();
  for (const entry of recentWeights) weightByDay.set(dateString(entry.date), entry.weightKg);
  const trend = (count) => {
    const { start } = dayWindow(selectedDate, count);
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index);
      const key = dateString(date);
      return { date: key, weightKg: weightByDay.get(key) ?? null };
    });
  };
  const estimatedDailyCalories = estimateDailyCalories(request.user);
  const effectiveDailyCalories = request.user.calorieTargetOverride ?? estimatedDailyCalories;
  const goals = activeGoals.map((goal) => {
    let currentValue = goal.currentValue;
    if (goal.goalType === "weight") currentValue = latestWeight?.weightKg ?? goal.startValue;
    if (goal.goalType === "workouts") currentValue = weekWorkouts;
    if (goal.goalType === "calories") currentValue = totals.calories;
    return { ...goal.toObject(), ...getGoalProgress(goal, currentValue) };
  });

  response.json({
    date: selectedDate,
    activity: { workoutCount: dayWorkouts.length, durationMinutes: dayWorkouts.reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0) },
    workouts: dayWorkouts,
    nutrition: totals,
    foodLogs: dayLogs,
    calorieTarget: {
      estimated: estimatedDailyCalories,
      effective: effectiveDailyCalories,
      isCustom: request.user.calorieTargetOverride !== null,
      progress: effectiveDailyCalories ? Math.min(100, Math.round((totals.calories / effectiveDailyCalories) * 100)) : null,
    },
    latestWeightKg: latestWeight?.weightKg ?? null,
    bmi: latestWeight ? calculateBmi(latestWeight.weightKg, request.user.heightCm) : null,
    goals,
    trends: { sevenDays: trend(7), thirtyDays: trend(30) },
  });
}));

export default router;
