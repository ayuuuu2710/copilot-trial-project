import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Session, User } from "./models.js";

export function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

export function requireOrigin(request, response, next) {
  const origin = request.get("origin");
  if (!origin) return response.status(403).json({ error: "A valid request origin is required." });
  try {
    if (new URL(origin).origin !== process.env.CLIENT_ORIGIN) {
      return response.status(403).json({ error: "Request origin is not allowed." });
    }
  } catch {
    return response.status(403).json({ error: "Request origin is not allowed." });
  }
  next();
}

export async function authenticate(request, response, next) {
  const token = request.cookies.fitbuddy_session;
  if (!token) return response.status(401).json({ error: "Please sign in to continue." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.sub || !payload.sid || !mongoose.isValidObjectId(payload.sub) || !mongoose.isValidObjectId(payload.sid)) {
      return response.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
    const session = await Session.findOne({
      _id: payload.sid,
      userId: payload.sub,
      expiresAt: { $gt: new Date() },
    });
    const user = session ? await User.findById(payload.sub) : null;
    if (!user) return response.status(401).json({ error: "Your session has expired. Please sign in again." });
    request.user = user;
    request.sessionId = session.id;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return response.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
    next(error);
  }
}

export function validate(schema) {
  return (request, response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      return response.status(400).json({
        error: "Please check the highlighted information and try again.",
        details: result.error.issues.map(({ path, message }) => ({ field: path.join("."), message })),
      });
    }
    request.validatedBody = result.data;
    next();
  };
}

export function notFound(request, response) {
  response.status(404).json({ error: "The requested resource was not found." });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);
  if (error?.code === 11000) {
    return response.status(409).json({ error: "An account with that email already exists." });
  }
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return response.status(400).json({ error: "The submitted information is invalid." });
  }
  if (process.env.NODE_ENV !== "test") console.error(error);
  return response.status(500).json({ error: "Something went wrong. Please try again." });
}
