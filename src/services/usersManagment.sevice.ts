import type { Request, Response } from "express";
import type { User } from "../types.js";
import fs from "fs/promises";
import crypto from "crypto";

export async function loadUsers(): Promise<User[]> {
  try {
    const data = await fs.readFile("src/users.json", "utf-8");
    const parsed = JSON.parse(data) as { users: User[] };
    return parsed.users ?? [];
  } catch (error) {
    console.log("Error loading users: ", error);
    return [];
  }
}

export async function saveUsers(users: User[]): Promise<void> {
  await fs.writeFile(
    "src/users.json",
    JSON.stringify({ users }, null, 2),
    "utf-8",
  );
}

export function getBearerToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;

  return authHeader.slice("Bearer ".length);
}

async function getUserFromAuthHeader(
  authHeader?: string,
): Promise<User | null> {
  const users = await loadUsers();

  const token = getBearerToken(authHeader);
  if (!token) return null;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = users.find((u) => u.sessionTokenHash === tokenHash);

  if (
    !user?.sessionTokenExpiresAt ||
    new Date(user.sessionTokenExpiresAt).getTime() < Date.now()
  ) {
    user!.sessionTokenHash = null;
    user!.sessionTokenExpiresAt = null;
    await saveUsers(users);
    return null;
  }

  return user;
}

export async function getUserLists(req: Request, res: Response) {
  const user = await getUserFromAuthHeader(req.headers.authorization);

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return res.status(200).json({
    watched: user.watched,
    queued: user.queued,
  });
}

export async function listName(req: Request, res: Response) {
  const users = await loadUsers();
  const authUser = await getUserFromAuthHeader(req.headers.authorization);

  if (!authUser) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = users.find((u) => u.id === authUser.id);

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
}
