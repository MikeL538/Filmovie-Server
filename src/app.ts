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
} from "./services/authPassword.service.js";
import { getUserLists, listName } from "./services/usersManagment.sevice.js";

export const app = express();
export const SALT_ROUNDS = 12;

const allowedOrigins = [
  "http://localhost:1234", // Parcel dev
  "http://localhost:3000", // jeśli frontend czasem tu działa
  "https://mikel538.github.io", // GitHub Pages origin
];

// Old manual way of setting URLs
// export const API_BASE_URL = "https://filmovie-server.onrender.com";
// export const FRONTEND_BASE_URL = "https://mikel538.github.io/Filmovie";
// export const API_BASE_URL = "http://localhost:3000";
// export const FRONTEND_BASE_URL = "http://localhost:1234/Filmovie";

// If env has urls, if not ->
export const API_BASE_URL =
  process.env.API_BASE_URL || "https://filmovie-server.onrender.com";

export const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || "https://mikel538.github.io/Filmovie";

export const resendApiKey = process.env.RESEND_API_KEY;
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
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
app.get("/api/users/me/lists", getUserLists);
app.put("/api/users/me/lists/:listName", listName);
