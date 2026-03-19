import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { loadUsers, saveUsers } from "./usersManagment.sevice.js";
import type { User } from "../types.js";
import { API_BASE_URL, resend, SALT_ROUNDS } from "../app.js";

async function sendVerificationEmail(email: string, activationLink: string) {
  if (!resend) {
    console.error("RESEND_API_KEY is missing.");
    throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
  }

  const { error } = await resend.emails.send({
    from: "Filmovie <verify@mail.mikeldev.online>",
    to: email,
    subject: "Verify your account",
    html: `<p>Click <a href="${activationLink}">here</a> to verify Your account or use link below:</p>
   
    <p><a href="${activationLink}">${activationLink}</a></p>`,
  });

  if (error) console.log("RESEND ERROR:", error);

  if (error) {
    throw new Error("VERIFICATION_EMAIL_FAILED");
  }
}

export async function register(req: Request, res: Response) {
  const { login, password, email } = req.body ?? {};
  const users: User[] = await loadUsers();

  if (!login || !password || !email) {
    return res.status(400).json({ message: "Login and password are required" });
  }

  if (typeof login !== "string" || login.length < 3) {
    return res
      .status(401)
      .json({ code: "LOGIN_TOO_SHORT", message: "login too short" });
  }
  if (typeof login !== "string" || login.length > 16) {
    return res
      .status(422)
      .json({ code: "LOGIN_TOO_LONG", message: "login too long" });
  }

  if (typeof password !== "string" || password.length < 3) {
    return res
      .status(422)
      .json({ code: "PASSWORD_TOO_SHORT", message: "password too short" });
  }

  if (typeof password !== "string" || password.length > 32) {
    return res
      .status(422)
      .json({ code: "PASSWORD_TOO_LONG", message: "password too long" });
  }

  const loginFormat =
    login.charAt(0).toUpperCase() + login.slice(1).toLowerCase();

  const existsUser = users.some((u) => u.login === loginFormat);
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

  const verificationTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const activationLink = `${API_BASE_URL}/api/auth/verify-email?token=${verificationToken}`;

  try {
    await sendVerificationEmail(email, activationLink);
  } catch (error) {
    return res.status(502).json({
      code: "VERIFICATION_EMAIL_FAILED",
      message: "Failed to send verification email",
    });
  }

  const newUser: User = {
    id: users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1,
    login: loginFormat,
    hashedPassword,
    email,
    verified: false,
    verificationTokenHash,
    verificationTokenExpiresAt,
    passwordResetTokenHash: null,
    passwordResetTokenExpiresAt: null,
    watched: [],
    queued: [],
    activationLink,
  };

  users.push(newUser);
  await saveUsers(users);

  return res.status(201).json({
    code: "VERIFICATION_EMAIL_SENT",
    message: "Verification email sent",
  });
}

export async function verifyEmail(req: Request, res: Response) {
  const token = String(req.query.token ?? "");
  const users: User[] = await loadUsers();

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
  user.activationLink = null;

  await saveUsers(users);

  return res.status(200).json({
    code: "EMAIL_VERIFIED",
    message: "Email verified successfully",
  });
}

export async function resendVerificationEmail(req: Request, res: Response) {
  const login = String(req.query.login ?? "");

  if (!login) {
    return res.status(400).json({ code: "LOGIN_REQUIRED" });
  }

  const users = await loadUsers();
  const user = users.find((u) => u.login === login);

  if (!user) {
    return res.status(404).json({ code: "USER_NOT_FOUND" });
  }

  if (user.verified) {
    return res.status(400).json({ code: "ALREADY_VERIFIED" });
  }

  const expiresAt = user.verificationTokenExpiresAt
    ? new Date(user.verificationTokenExpiresAt).getTime()
    : 0;

  const minutesLeft = Math.floor((expiresAt - Date.now()) / (60 * 1000));

  if (minutesLeft > 58) {
    return res.status(429).json({ code: "RESEND_TOO_EARLY" });
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationTokenHash = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  const activationLink = `${API_BASE_URL}/api/auth/verify-email?token=${verificationToken}`;

  user.verificationTokenHash = verificationTokenHash;
  user.verificationTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  user.activationLink = activationLink;

  try {
    await sendVerificationEmail(user.email, activationLink);
  } catch (error) {
    return res.status(502).json({
      code: "VERIFICATION_EMAIL_FAILED",
      message: "Failed to send verification email",
    });
  }

  await saveUsers(users);

  return res.status(200).json({
    code: "VERIFICATION_EMAIL_RESENT",
    message: "Verification email resent",
  });
}
