export type User = {
  id: number;
  login: string;
  hashedPassword: string;
  email: string;

  verified: boolean;
  verificationTokenHash: string | null;
  verificationTokenExpiresAt: Date | null;

  passwordResetTokenHash: string | null;
  passwordResetTokenExpiresAt: Date | null;

  sessionTokenHash: string | null;
  sessionTokenExpiresAt: string | null;

  watched: number[];
  queued: number[];
  activationLink: string | null;
};
