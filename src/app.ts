import express from "express";
import cors from "cors";

export const app = express();

app.use(cors());
app.use(express.json());
console.log("test");

const TEST_TOKEN = "filmoteka-test-token";

type User = {
  id: number;
  login: string;
  password: string;
  watched: number[];
  queued: number[];
};

const users: User[] = [
  {
    id: 1,
    login: "test",
    password: "test",
    watched: [603, 238],
    queued: [155, 27205],
  },
  {
    id: 2,
    login: "test2",
    password: "test2",
    watched: [1236153, 1272837, 1428862],
    queued: [755, 2205],
  },
];

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
  res.status(200).json({ ok: true, service: "filmoteka-server" });
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

app.put("/api/users/me/lists/:listName", (req, res) => {
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

  return res.status(200).json({
    watched: user.watched,
    queued: user.queued,
  });
});
