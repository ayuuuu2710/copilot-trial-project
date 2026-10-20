import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import { Session, User } from "./models.js";
import { asyncRoute, authenticate, validate } from "./middleware.js";
import { changePasswordSchema, loginSchema, publicProfile, registerSchema } from "./schemas.js";

const router = Router();
const sessionDurationMs = 24 * 60 * 60 * 1000;
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please try again in 15 minutes." },
});

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: sessionDurationMs,
  };
}

function clearCookieOptions() {
  const options = cookieOptions();
  delete options.maxAge;
  return options;
}

async function establishSession(user, response) {
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  const session = await Session.create({ userId: user._id, expiresAt });
  const token = jwt.sign(
    { sub: String(user._id), sid: String(session._id) },
    process.env.JWT_SECRET,
    { expiresIn: "24h", issuer: "fitbuddy" },
  );
  response.cookie("fitbuddy_session", token, cookieOptions());
}

router.post("/register", authLimit, validate(registerSchema), asyncRoute(async (request, response) => {
  const { name, email, password } = request.validatedBody;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email: email.toLowerCase(), passwordHash });
  await establishSession(user, response);
  response.status(201).json({ user: publicProfile(user) });
}));

router.post("/login", authLimit, validate(loginSchema), asyncRoute(async (request, response) => {
  const user = await User.findOne({ email: request.validatedBody.email.toLowerCase() }).select("+passwordHash");
  const passwordMatches = user && await bcrypt.compare(request.validatedBody.password, user.passwordHash);
  if (!passwordMatches) return response.status(401).json({ error: "Email or password is incorrect." });
  await establishSession(user, response);
  response.json({ user: publicProfile(user) });
}));

router.post("/logout", asyncRoute(async (request, response) => {
  const token = request.cookies.fitbuddy_session;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.sid) await Session.deleteOne({ _id: payload.sid });
    } catch (error) {
      if (error.name !== "JsonWebTokenError" && error.name !== "TokenExpiredError") throw error;
    }
  }
  response.clearCookie("fitbuddy_session", clearCookieOptions());
  response.json({ message: "You have been signed out." });
}));

router.get("/me", authenticate, (request, response) => {
  response.json({ user: publicProfile(request.user) });
});

router.post("/change-password", authenticate, authLimit, validate(changePasswordSchema), asyncRoute(async (request, response) => {
  const user = await User.findById(request.user._id).select("+passwordHash");
  const passwordMatches = user && await bcrypt.compare(request.validatedBody.currentPassword, user.passwordHash);
  if (!passwordMatches) return response.status(401).json({ error: "Your current password is incorrect." });

  user.passwordHash = await bcrypt.hash(request.validatedBody.newPassword, 12);
  await user.save();
  await Session.deleteMany({ userId: user._id });
  await establishSession(user, response);
  response.json({ user: publicProfile(user) });
}));

export default router;
