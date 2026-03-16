import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { loadUsers, saveUsers } from "./usersManagment.sevice.js";
import type { User } from "../types.js";
import { FRONTEND_BASE_URL, resend, SALT_ROUNDS } from "../app.js";

export async function loginUser(req: Request, res: Response) {
  const { login, password } = req.body ?? {};

  const users: User[] = await loadUsers();

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
    });
  }

  const token = `token-${user.id}`;
  return res.status(200).json({
    token,
    user: { id: user.id, login: user.login },
    lists: { watched: user.watched, queued: user.queued },
  });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body ?? {};
  const users: User[] = await loadUsers();

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const user = users.find((u) => u.email === email);

  if (user?.email !== email) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const passwordResetToken = crypto.randomBytes(32).toString("hex");
  const passwordResetTokenHash = crypto
    .createHash("sha256")
    .update(passwordResetToken)
    .digest("hex");

  const passwordResetTokenExpiresAt = new Date(
    Date.now() + 24 * 60 * 60 * 1000,
  );

  const passwordResetLink = `${FRONTEND_BASE_URL}/reset-password.html?token=${passwordResetToken}`;

  if (!resend) {
    console.error("RESEND_API_KEY is missing.");
    return res.status(500).json({
      code: "EMAIL_PROVIDER_NOT_CONFIGURED",
      message: "Email provider is not configured",
    });
  }

  const { data, error } = await resend.emails.send({
    from: "Filmovie <reset-password@mail.mikeldev.online>",
    to: email,
    subject: "Reset your password",
    html: `<p>Click <a href="${passwordResetLink}">here</a> to reset Your password or use link below:</p>
   
    <p><a href="${passwordResetLink}">${passwordResetLink}</a></p>`,
  });

  if (error) console.log("RESEND ERROR:", error);

  if (error) {
    console.error("Failed to send verification email:", error);

    return res.status(502).json({
      code: "VERIFICATION_EMAIL_FAILED",
      message: "Failed to send verification email",
    });
  }

  user!.passwordResetTokenHash = passwordResetTokenHash;
  user!.passwordResetTokenExpiresAt = passwordResetTokenExpiresAt;

  await saveUsers(users);

  return res.status(200).json({
    code: "Password changed",
    message: "Password changed",
  });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body ?? {};
  const users: User[] = await loadUsers();

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
  const user = users.find((u) => u.passwordResetTokenHash === tokenHash);

  if (!user) {
    return res.status(400).json({ code: "INVALID_TOKEN" });
  }

  if (
    !user.passwordResetTokenExpiresAt ||
    new Date(user.passwordResetTokenExpiresAt).getTime() < Date.now()
  ) {
    return res.status(400).json({ code: "TOKEN_EXPIRED" });
  }

  user.hashedPassword = await bcrypt.hash(String(password), SALT_ROUNDS);
  user.passwordResetTokenHash = null;
  user.passwordResetTokenExpiresAt = null;

  await saveUsers(users);

  return res.status(200).json({
    code: "PASSWORD_RESET_SUCCESS",
    message: "Password changed successfully",
  });
}
