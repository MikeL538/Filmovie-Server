import type { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";

export function getBearerToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;

  return authHeader.slice("Bearer ".length);
}

async function getUserFromAuthHeader(authHeader?: string) {
  const token = getBearerToken(authHeader);
  if (!token) return null;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: { sessionTokenHash: tokenHash },
  });

  if (!user) {
    return null;
  }

  if (
    !user.sessionTokenExpiresAt ||
    user.sessionTokenExpiresAt.getTime() < Date.now()
  ) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        sessionTokenHash: null,
        sessionTokenExpiresAt: null,
      },
    });

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
  const user = await getUserFromAuthHeader(req.headers.authorization);

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

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      [listName]: normalizedIds,
    },
  });

  return res.status(200).json({
    watched: updatedUser.watched,
    queued: updatedUser.queued,
  });
}
