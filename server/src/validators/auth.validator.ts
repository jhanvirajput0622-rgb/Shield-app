import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address").toLowerCase(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password too long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
        "Password must contain uppercase, lowercase, number and special character"
      ),
    name: z.string().trim().min(1, "Name is required").max(128).optional(),
    displayName: z.string().trim().max(64).optional(),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number")
      .optional()
      .or(z.literal("")),
    confirmPassword: z.string().optional(),
  }).refine(
    (data) =>
      !data.confirmPassword || data.password === data.confirmPassword,
    { message: "Passwords do not match", path: ["confirmPassword"] }
  ),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address").toLowerCase(),
    password: z.string().min(1, "Password is required"),
    otp: z.string().optional(),
  }),
});

export const googleAuthSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, "Google ID token is required"),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "refreshToken is required"),
  }),
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address").toLowerCase(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Reset token is required"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password too long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
        "Password must contain uppercase, lowercase, number and special character"
      ),
    confirmPassword: z.string().optional(),
  }).refine(
    (data) => !data.confirmPassword || data.password === data.confirmPassword,
    { message: "Passwords do not match", path: ["confirmPassword"] }
  ),
});

export const verify2FASchema = z.object({
  body: z.object({
    otp: z.string().min(1, "OTP is required"),
  }),
});

export const disable2FASchema = z.object({
  body: z.object({
    password: z.string().min(1, "Password is required"),
  }),
});

export type RegisterBody = z.infer<typeof registerSchema>["body"];
export type LoginBody = z.infer<typeof loginSchema>["body"];
export type GoogleAuthBody = z.infer<typeof googleAuthSchema>["body"];
export type RefreshBody = z.infer<typeof refreshSchema>["body"];
export type LogoutBody = z.infer<typeof logoutSchema>["body"];
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>["body"];
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>["body"];
export type Verify2FABody = z.infer<typeof verify2FASchema>["body"];
export type Disable2FABody = z.infer<typeof disable2FASchema>["body"];
