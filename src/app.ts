import express from "express";
import cors from "cors";
import fs from "fs/promises";
export const app = express();

const allowedOrigins = [
  "http://localhost:1234", // Parcel dev
  "http://localhost:3000", // jeśli frontend czasem tu działa
  "https://mikel538.github.io", // GitHub Pages origin
];

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
  password: string;
  watched: number[];
  queued: number[];
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

app.post("/api/auth/login", (req, res) => {
  const { login, password } = req.body ?? {};

  const user = users.find((u) => u.login === login && u.password === password);

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
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

app.post("/api/auth/register", async (req, res) => {
  const { login, password } = req.body ?? {};

  if (!login || !password) {
    return res.status(400).json({ message: "Login and password are required" });
  }

  const exists = users.some((u) => u.login === login);
  if (exists) {
    return res.status(409).json({ message: "Login already exists" });
  }

  const newUser: User = {
    id: users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1,
    login,
    password,
    watched: [],
    queued: [],
  };

  users.push(newUser);
  await saveUsers(users);

  const token = `token-${newUser.id}`;
  return res.status(201).json({
    token,
    user: { id: newUser.id, login: newUser.login },
    lists: { watched: [], queued: [] },
  });
});
