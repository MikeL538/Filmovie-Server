import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { getBearerToken } from "./usersManagment.sevice.js";
import { FRONTEND_BASE_URL, resend, SALT_ROUNDS } from "../app.js";
import { prisma } from "../lib/prisma.js";

export async function loginUser(req: Request, res: Response) {
  const { login, password } = req.body ?? {};

  if (typeof login !== "string" || typeof password !== "string") {
    return res.status(400).json({ code: "LOGIN_AND_PASSWORD_REQUIRED" });
  }

  const loginFormat =
    login.charAt(0).toUpperCase() + login.slice(1).toLowerCase();

  const user = await prisma.user.findUnique({
    where: { login: loginFormat },
  });

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const passwordMatches = user.hashedPassword.startsWith("$2")
    ? await bcrypt.compare(password, user.hashedPassword)
    : password === user.hashedPassword;

  if (!passwordMatches) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!user.verified) {
    return res.status(403).json({
      code: "LOGIN_403",
      message: "User not verified",
    });
  }

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionTokenHash = crypto
    .createHash("sha256")
    .update(sessionToken)
    .digest("hex");
  const sessionTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      sessionTokenHash,
      sessionTokenExpiresAt,
    },
  });

  return res.status(200).json({
    token: sessionToken,
    user: { id: user.id, loginFormat: user.login },
    lists: { watched: user.watched, queued: user.queued },
  });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body ?? {};

  if (typeof email !== "string" || !email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const passwordResetToken = crypto.randomBytes(32).toString("hex");
  const passwordResetTokenHash = crypto
    .createHash("sha256")
    .update(passwordResetToken)
    .digest("hex");
  const passwordResetTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const passwordResetLink = `${FRONTEND_BASE_URL}/reset-password.html?token=${passwordResetToken}`;

  if (!resend) {
    console.error("RESEND_API_KEY is missing.");
    return res.status(500).json({
      code: "EMAIL_PROVIDER_NOT_CONFIGURED",
      message: "Email provider is not configured",
    });
  }

  const { error } = await resend.emails.send({
    from: "Filmovie <reset-password@mail.mikeldev.online>",
    to: email,
    subject: "Reset your password",
    html: `<p>Click <a href="${passwordResetLink}">here</a> to reset your password or use link below:</p>

    <p><a href="${passwordResetLink}">${passwordResetLink}</a></p>`,
  });

  if (error) {
    console.log("RESEND ERROR:", error);
    console.error("Failed to send verification email:", error);

    return res.status(502).json({
      code: "VERIFICATION_EMAIL_FAILED",
      message: "Failed to send verification email",
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash,
      passwordResetTokenExpiresAt,
    },
  });

  return res.status(200).json({
    code: "PASSWORD_RESET_EMAIL_SENT",
    message: "Password reset email sent",
  });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body ?? {};

  if (!token) {
    return res.status(400).json({ code: "TOKEN_REQUIRED" });
  }

  if (!password) {
    return res.status(400).json({ code: "PASSWORD_REQUIRED" });
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(String(token))
    .digest("hex");
  const user = await prisma.user.findFirst({
    where: { passwordResetTokenHash: tokenHash },
  });

  if (!user) {
    return res.status(400).json({ code: "INVALID_TOKEN" });
  }

  if (
    !user.passwordResetTokenExpiresAt ||
    user.passwordResetTokenExpiresAt.getTime() < Date.now()
  ) {
    return res.status(400).json({ code: "TOKEN_EXPIRED" });
  }

  const hashedPassword = await bcrypt.hash(String(password), SALT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      hashedPassword,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
    },
  });

  return res.status(200).json({
    code: "PASSWORD_RESET_SUCCESS",
    message: "Password changed successfully",
  });
}

export async function logoutClearToken(req: Request, res: Response) {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(400).json({ code: "TOKEN_REQUIRED" });
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(String(token))
    .digest("hex");

  const user = await prisma.user.findFirst({
    where: { sessionTokenHash: tokenHash },
  });

  if (!user) {
    return res.status(400).json({ code: "INVALID_TOKEN" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      sessionTokenHash: null,
      sessionTokenExpiresAt: null,
    },
  });

  return res.status(200).json({ code: "LOGOUT_SUCCESS" });
}
