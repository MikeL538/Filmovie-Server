import "dotenv/config";
import express from "express";
import cors from "cors";
import { Resend } from "resend";
import {
  register,
  verifyEmail,
  resendVerificationEmail,
} from "./services/authRegistration.service.js";
import {
  loginUser,
  forgotPassword,
  resetPassword,
  logoutClearToken,
} from "./services/authPassword.service.js";
import { getUserLists, listName } from "./services/usersManagment.sevice.js";

export const app = express();
export const SALT_ROUNDS = 12;

export const API_BASE_URL =
  process.env.API_BASE_URL || "https://filmovie-server.onrender.com";

export const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || "https://mikel538.github.io/Filmovie";

function getOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const allowedOrigins = new Set(
  [
    "http://localhost:1234",
    "http://localhost:3000",
    "https://mikel538.github.io",
    "https://filmovie.mikeldev.online",
    getOrigin(FRONTEND_BASE_URL),
  ].filter((origin): origin is string => Boolean(origin)),
);

export const resendApiKey = process.env.RESEND_API_KEY;
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "filmovie-server",
    message: "Filmovie-Server is Running",
  });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "filmovie-server",
    message: "Filmovie-Server is Running",
  });
});

app.post("/api/auth/register", register);
app.get("/api/auth/verify-email", verifyEmail);
app.get("/api/auth/resend-verify-email", resendVerificationEmail);
app.post("/api/auth/login", loginUser);
app.post("/api/auth/forgot-password", forgotPassword);
app.post("/api/auth/reset-password", resetPassword);
app.post("/api/auth/logout", logoutClearToken);
app.get("/api/users/me/lists", getUserLists);
app.put("/api/users/me/lists/:listName", listName);
