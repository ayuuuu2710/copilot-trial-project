import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import authRouter from "./auth.js";
import apiRouter from "./routes.js";
import { errorHandler, notFound, requireOrigin } from "./middleware.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "connect-src": ["'self'", process.env.CLIENT_ORIGIN ?? "http://localhost:5173"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use((request, response, next) => {
  if (request.path.startsWith("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    return requireOrigin(request, response, next);
  }
  next();
});

app.get("/api/health", (request, response) => response.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
