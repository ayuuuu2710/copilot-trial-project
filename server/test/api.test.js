import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "fitbuddy-test-secret-that-is-at-least-32-characters";
process.env.CLIENT_ORIGIN = "http://localhost:5173";

let mongo;
let app;
let User;
let userA;
let userB;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  ({ default: app } = await import("../src/app.js"));
  ({ User } = await import("../src/models.js"));
  userA = request.agent(app);
  userB = request.agent(app);
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

const origin = (agent) => agent.set("Origin", process.env.CLIENT_ORIGIN);

async function register(agent, name, email) {
  return origin(agent.post("/api/auth/register")).send({ name, email, password: "private-password-42" });
}

test("registration hashes passwords, sets an HTTP-only cookie, and rejects duplicate email", async () => {
  const result = await register(userA, "Alex Morgan", "alex@example.com");
  assert.equal(result.status, 201);
  assert.match(result.headers["set-cookie"][0], /HttpOnly/);
  assert.match(result.headers["set-cookie"][0], /SameSite=Strict/i);
  const user = await User.findOne({ email: "alex@example.com" }).select("+passwordHash");
  assert.ok(user.passwordHash);
  assert.notEqual(user.passwordHash, "private-password-42");
  assert.equal(await bcrypt.compare("private-password-42", user.passwordHash), true);
  assert.equal((await register(request.agent(app), "Alex Again", "alex@example.com")).status, 409);
});

test("logout invalidates the server-side session for the old cookie", async () => {
  const result = await origin(userA.post("/api/auth/login")).send({ email: "alex@example.com", password: "private-password-42" });
  assert.equal(result.status, 200);
  const cookie = result.headers["set-cookie"][0].split(";")[0];
  assert.equal((await userA.get("/api/auth/me")).status, 200);
  assert.equal((await origin(userA.post("/api/auth/logout"))).status, 200);
  assert.equal((await request(app).get("/api/auth/me").set("Cookie", cookie)).status, 401);
  assert.equal((await origin(userA.post("/api/auth/login")).send({ email: "alex@example.com", password: "private-password-42" })).status, 200);
});

test("protected APIs reject missing sessions and cookie mutations reject missing origins", async () => {
  assert.equal((await request(app).get("/api/workouts")).status, 401);
  assert.equal((await userA.post("/api/workouts").send({})).status, 403);
});

test("user ownership is enforced and workout records support CRUD and validation", async () => {
  assert.equal((await register(userB, "Sam Lee", "sam@example.com")).status, 201);
  const workoutBody = {
    kind: "strength", date: "2026-10-18", exerciseName: "Goblet squat", sets: 3, repetitions: 10, resistanceKg: 12, notes: "",
  };
  const created = await origin(userA.post("/api/workouts")).send(workoutBody);
  assert.equal(created.status, 201);
  const id = created.body.workout._id;
  assert.deepEqual((await userB.get("/api/workouts")).body.workouts, []);
  assert.equal((await origin(userB.put(`/api/workouts/${id}`)).send(workoutBody)).status, 404);
  assert.equal((await userB.delete(`/api/workouts/${id}`).set("Origin", process.env.CLIENT_ORIGIN)).status, 404);
  assert.equal((await origin(userA.post("/api/workouts")).send({ ...workoutBody, sets: 0 })).status, 400);
  assert.equal((await origin(userA.post("/api/workouts")).send({ ...workoutBody, date: "2026-02-31" })).status, 400);
  const updated = await origin(userA.put(`/api/workouts/${id}`)).send({ ...workoutBody, sets: 4 });
  assert.equal(updated.body.workout.sets, 4);
  assert.equal((await userA.delete(`/api/workouts/${id}`).set("Origin", process.env.CLIENT_ORIGIN)).status, 200);
});

test("profile, weight, nutrition, goals, and dashboard summaries stay consistent", async () => {
  const profile = await origin(userA.put("/api/profile")).send({
    age: 30, sexForCalculation: "female", heightCm: 170, currentWeightKg: 70, activityLevel: "moderate",
    unitSystem: "metric", calorieTargetOverride: null,
  });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.estimatedDailyCalories, 2250);

  const firstWeight = await origin(userA.post("/api/weights")).send({ date: "2026-10-17", weightKg: 72, notes: "" });
  const latestWeight = await origin(userA.post("/api/weights")).send({ date: "2026-10-18", weightKg: 70, notes: "" });
  assert.equal(firstWeight.status, 201);
  assert.equal(latestWeight.status, 201);
  assert.equal((await userA.get("/api/profile")).body.profile.currentWeightKg, 70);

  const foodLog = await origin(userA.post("/api/food-logs")).send({
    foodId: "starter-002", date: "2026-10-18", meal: "breakfast", quantityGrams: 200,
  });
  assert.equal(foodLog.status, 201);
  assert.equal(foodLog.body.foodLog.nutrients.calories, 178);
  assert.equal(foodLog.body.foodLog.nutrients.carbohydrates, 45.6);

  const customFood = await origin(userA.post("/api/foods/custom")).send({
    name: "My trail mix", calories: 250, protein: 8, carbohydrates: 25, fat: 12,
  });
  assert.equal(customFood.status, 201);
  const customFoodId = customFood.body.food.id;
  assert.equal((await userB.get(`/api/foods/custom/${customFoodId}`)).status, 404);
  assert.equal((await userA.get(`/api/foods/custom/${customFoodId}`)).body.food.name, "My trail mix");
  assert.equal((await origin(userA.put(`/api/foods/custom/${customFoodId}`)).send({
    name: "Trail mix", calories: 260, protein: 9, carbohydrates: 24, fat: 13,
  })).body.food.calories, 260);
  const customLog = await origin(userA.post("/api/food-logs")).send({
    foodId: customFoodId, date: "2026-10-18", meal: "snack", quantityGrams: 50,
  });
  assert.equal(customLog.body.foodLog.nutrients.calories, 130);
  assert.equal((await origin(userA.delete(`/api/foods/custom/${customFoodId}`))).status, 200);
  assert.equal((await userA.get("/api/food-logs?date=2026-10-18")).body.foodLogs.length, 2);
  assert.equal((await origin(userA.put(`/api/food-logs/${foodLog.body.foodLog._id}`)).send({
    foodId: "starter-002", date: "2026-10-18", meal: "lunch", quantityGrams: 100,
  })).body.foodLog.nutrients.calories, 89);

  const goal = await origin(userA.post("/api/goals")).send({
    title: "Walk and move", goalType: "custom", targetValue: 10, startValue: 0, currentValue: 12,
    direction: "up", unit: "sessions", active: true,
  });
  assert.equal(goal.status, 201);
  const workoutGoal = await origin(userA.post("/api/goals")).send({
    title: "Three sessions", goalType: "workouts", targetValue: 3, startValue: 0, currentValue: 0,
    direction: "up", unit: "workouts", active: true,
  });
  assert.equal(workoutGoal.status, 201);
  const workout = await origin(userA.post("/api/workouts")).send({
    kind: "cardio", date: "2026-10-18", activityType: "Walk", durationMinutes: 30, distanceKm: 2, notes: "",
  });
  assert.equal(workout.status, 201);
  const dashboard = await userA.get("/api/dashboard?date=2026-10-18");
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.nutrition.calories, 219);
  assert.equal(dashboard.body.nutrition.protein, 5.6);
  assert.equal(dashboard.body.activity.workoutCount, 1);
  assert.equal(dashboard.body.bmi, 24.2);
  assert.equal(dashboard.body.trends.sevenDays.length, 7);
  assert.equal(dashboard.body.trends.thirtyDays.length, 30);
  assert.equal(dashboard.body.trends.sevenDays[5].weightKg, 72);
  assert.equal(dashboard.body.trends.sevenDays[6].weightKg, 70);
  assert.equal(dashboard.body.goals.find((item) => item._id === goal.body.goal._id).progress, 100);
  assert.equal(dashboard.body.goals.find((item) => item._id === goal.body.goal._id).complete, true);
  assert.equal(dashboard.body.goals.find((item) => item._id === workoutGoal.body.goal._id).currentValue, 1);

  assert.equal((await origin(userA.put(`/api/weights/${latestWeight.body.weightEntry._id}`)).send({ date: "2026-10-18", weightKg: 69, notes: "Updated" })).status, 200);
  assert.equal((await userA.get("/api/profile")).body.profile.currentWeightKg, 69);
  assert.equal((await userB.get("/api/dashboard?date=2026-10-18")).body.activity.workoutCount, 0);
  assert.equal((await userB.get("/api/food-logs?date=2026-10-18")).body.foodLogs.length, 0);
  assert.equal((await userB.get("/api/weights")).body.weightEntries.length, 0);

  assert.equal((await userA.delete(`/api/workouts/${workout.body.workout._id}`).set("Origin", process.env.CLIENT_ORIGIN)).status, 200);
  assert.equal((await userA.delete(`/api/food-logs/${foodLog.body.foodLog._id}`).set("Origin", process.env.CLIENT_ORIGIN)).status, 200);
  assert.equal((await userA.delete(`/api/food-logs/${customLog.body.foodLog._id}`).set("Origin", process.env.CLIENT_ORIGIN)).status, 200);
  assert.equal((await userA.delete(`/api/weights/${latestWeight.body.weightEntry._id}`).set("Origin", process.env.CLIENT_ORIGIN)).status, 200);
  assert.equal((await userA.delete(`/api/weights/${firstWeight.body.weightEntry._id}`).set("Origin", process.env.CLIENT_ORIGIN)).status, 200);
  assert.equal((await userA.delete(`/api/goals/${goal.body.goal._id}`).set("Origin", process.env.CLIENT_ORIGIN)).status, 200);
  assert.equal((await origin(userA.put(`/api/goals/${workoutGoal.body.goal._id}`)).send({
    title: "Three weekly sessions", goalType: "workouts", targetValue: 4, startValue: 0, currentValue: 0,
    direction: "up", unit: "workouts", active: true,
  })).body.goal.targetValue, 4);
  assert.equal((await userA.delete(`/api/goals/${workoutGoal.body.goal._id}`).set("Origin", process.env.CLIENT_ORIGIN)).status, 200);
});

test("password changes verify the current password and revoke other active sessions", async () => {
  const account = request.agent(app);
  const otherSession = request.agent(app);
  assert.equal((await register(account, "Password Owner", "password-owner@example.com")).status, 201);
  assert.equal((await origin(otherSession.post("/api/auth/login")).send({
    email: "password-owner@example.com",
    password: "private-password-42",
  })).status, 200);

  const wrongPassword = await origin(account.post("/api/auth/change-password")).send({
    currentPassword: "wrong-password",
    newPassword: "a-new-private-password-43",
  });
  assert.equal(wrongPassword.status, 401);
  assert.equal((await account.get("/api/auth/me")).status, 200);

  const changed = await origin(account.post("/api/auth/change-password")).send({
    currentPassword: "private-password-42",
    newPassword: "a-new-private-password-43",
  });
  assert.equal(changed.status, 200);
  assert.equal((await account.get("/api/auth/me")).status, 200);
  assert.equal((await otherSession.get("/api/auth/me")).status, 401);
  assert.equal((await origin(request.agent(app).post("/api/auth/login")).send({
    email: "password-owner@example.com",
    password: "private-password-42",
  })).status, 401);
  assert.equal((await origin(request.agent(app).post("/api/auth/login")).send({
    email: "password-owner@example.com",
    password: "a-new-private-password-43",
  })).status, 200);
});

test("account export excludes credentials and deletion removes only the owner's data", async () => {
  const account = request.agent(app);
  assert.equal((await register(account, "Export Owner", "export-owner@example.com")).status, 201);
  const workout = await origin(account.post("/api/workouts")).send({
    kind: "strength",
    date: "2026-10-20",
    exerciseName: "Deadlift",
    sets: 2,
    repetitions: 5,
    notes: "",
  });
  assert.equal(workout.status, 201);

  const exported = await account.get("/api/account/export");
  assert.equal(exported.status, 200);
  assert.match(exported.headers["content-disposition"], /fitbuddy-data-\d{4}-\d{2}-\d{2}\.json/);
  assert.equal(exported.body.profile.email, "export-owner@example.com");
  assert.equal(exported.body.workouts.length, 1);
  assert.equal(JSON.stringify(exported.body).includes("passwordHash"), false);

  assert.equal((await origin(account.delete("/api/account")).send({ password: "wrong-password" })).status, 401);
  assert.equal((await account.get("/api/workouts")).body.workouts.length, 1);
  const deleted = await origin(account.delete("/api/account")).send({ password: "private-password-42" });
  assert.equal(deleted.status, 200);
  assert.equal((await account.get("/api/auth/me")).status, 401);
  assert.equal((await userA.get("/api/dashboard?date=2026-10-20")).body.activity.workoutCount, 0);
});

test("food-log undo restores the exact private nutrition snapshot", async () => {
  const account = request.agent(app);
  assert.equal((await register(account, "Restore Owner", "restore-owner@example.com")).status, 201);
  const restored = await origin(account.post("/api/food-logs/restore")).send({
    foodId: "starter-002",
    foodName: "Banana",
    date: "2026-10-20",
    meal: "snack",
    quantityGrams: 50,
    nutrientsPer100g: { calories: 89, protein: 1.1, carbohydrates: 22.8, fat: 0.3 },
  });
  assert.equal(restored.status, 201);
  assert.equal(restored.body.foodLog.nutrients.calories, 44.5);
  assert.equal((await account.get("/api/food-logs?date=2026-10-20")).body.foodLogs.length, 1);
  assert.equal((await userA.get("/api/food-logs?date=2026-10-20")).body.foodLogs.length, 0);
});
