import express from "express";
import cors from "cors";
import fs from "fs/promises";
import bcrypt from "bcrypt";
import crypto from "crypto";

export const app = express();
const SALT_ROUNDS = 12;

const allowedOrigins = [
  "http://localhost:1234", // Parcel dev
  "http://localhost:3000", // jeśli frontend czasem tu działa
  "https://mikel538.github.io", // GitHub Pages origin
];

const API_BASE_URL = "https://filmoteka-server-oso6.onrender.com";
// const API_BASE_URL = 'http://localhost:3000';

// Testing function for delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

type User = {
  id: number;
  login: string;
  hashedPassword: string;
  email: string;
  verified: boolean;
  verificationTokenHash: string | null;
  verificationTokenExpiresAt: Date | null;
  watched: number[];
  queued: number[];
  activationLink: string | null;
};

async function loadUsers(): Promise<User[]> {
  try {
    const data = await fs.readFile("src/users.json", "utf-8");
    const parsed = JSON.parse(data) as { users: User[] };
    return parsed.users ?? [];
  } catch (error) {
    console.log("Error loading users: ", error);
    return [];
  }
}

async function saveUsers(users: User[]): Promise<void> {
  await fs.writeFile(
    "src/users.json",
    JSON.stringify({ users }, null, 2),
    "utf-8",
  );
}

const users: User[] = await loadUsers();

function getBearerToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;

  return authHeader.slice("Bearer ".length);
}

function getUserFromAuthHeader(authHeader?: string) {
  const token = getBearerToken(authHeader);
  if (!token) return null;

  const match = token.match(/^token-(\d+)$/);
  if (!match) return null;

  const userId = Number(match[1]);
  return users.find((u) => u.id === userId) ?? null;
}

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

app.post("/api/auth/register", async (req, res) => {
  const { login, password, email } = req.body ?? {};

  if (!login || !password || !email) {
    return res.status(400).json({ message: "Login and password are required" });
  }

  const existsUser = users.some((u) => u.login === login);
  if (existsUser) {
    return res
      .status(409)
      .json({ code: "LOGIN_ALREADY_EXISTS", message: "Login already exists" });
  }

  const existsEmail = users.some((u) => u.email === email);
  if (existsEmail) {
    return res
      .status(409)
      .json({ code: "EMAIL_ALREADY_EXISTS", message: "Email already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationTokenHash = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // const activationLink = `http://localhost:3000/api/auth/verify-email?token=${verificationToken}`;

  const activationLink = `${API_BASE_URL}/api/auth/verify-email?token=${verificationToken}`;

  const newUser: User = {
    id: users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1 || 0,
    login,
    hashedPassword: hashedPassword,
    email,
    verified: false,
    verificationTokenHash,
    verificationTokenExpiresAt,
    watched: [],
    queued: [],
    activationLink,
  };

  users.push(newUser);
  await saveUsers(users);

  // activation link for tests
  console.log("Activation link:", activationLink);

  return res.status(201).json({
    code: "VERIFICATION_EMAIL_SENT",
    message: "Verification email sent",
  });
});

app.get("/api/auth/verify-email", async (req, res) => {
  const token = String(req.query.token ?? "");

  if (!token) {
    return res.status(400).json({ code: "TOKEN_REQUIRED" });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = users.find((u) => u.verificationTokenHash === tokenHash);

  if (!user) {
    return res.status(400).json({ code: "INVALID_TOKEN" });
  }

  if (
    !user.verificationTokenExpiresAt ||
    new Date(user.verificationTokenExpiresAt).getTime() < Date.now()
  ) {
    return res.status(400).json({ code: "TOKEN_EXPIRED" });
  }

  user.verified = true;
  user.verificationTokenHash = null;
  user.verificationTokenExpiresAt = null;

  await saveUsers(users);

  return res.status(200).json({
    code: "EMAIL_VERIFIED",
    message: "Email verified successfully",
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { login, password } = req.body ?? {};

  const user = users.find((u) => u.login === login);

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const passwordMatches = user.hashedPassword.startsWith("$2")
    ? await bcrypt.compare(password, user.hashedPassword)
    : password === user.hashedPassword;

  if (!passwordMatches) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // ========= Email verification =========
  const isVerified = user.verified === true;

  if (!isVerified) {
    return res.status(403).json({
      code: "NOT_VERIFIED",
      message: "User not verified",
      activationLink: user.activationLink,
    });
  }

  const token = `token-${user.id}`;
  return res.status(200).json({
    token,
    user: { id: user.id, login: user.login },
    lists: { watched: user.watched, queued: user.queued },
  });
});

app.get("/api/users/me/lists", (req, res) => {
  const user = getUserFromAuthHeader(req.headers.authorization);

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return res.status(200).json({
    watched: user.watched,
    queued: user.queued,
  });
});

app.put("/api/users/me/lists/:listName", async (req, res) => {
  const user = getUserFromAuthHeader(req.headers.authorization);

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { listName } = req.params;
  const { movieIds } = req.body ?? {};

  if (listName !== "watched" && listName !== "queued") {
    return res.status(400).json({ message: "Unknown list name" });
  }

  if (!Array.isArray(movieIds)) {
    return res.status(400).json({ message: "movieIds must be an array" });
  }

  const normalizedIds = movieIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));

  user[listName] = normalizedIds;
  await saveUsers(users);

  return res.status(200).json({
    watched: user.watched,
    queued: user.queued,
  });
});
