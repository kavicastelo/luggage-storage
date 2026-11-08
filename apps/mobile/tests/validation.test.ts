import { describe, it, expect } from "vitest";
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  ChangePasswordRequestSchema,
  ResetPasswordRequestSchema
} from "@luggage-storage/contracts";
import { validateWithZod } from "../src/lib/validation";

describe("Mobile Zod Validation Helper & Contracts", () => {
  it("should validate valid mobile registration data", () => {
    const validData = {
      displayName: "Mobile Traveller",
      email: "mobile@example.com",
      password: "StrongPassword123!"
    };

    const res = validateWithZod(RegisterRequestSchema, validData);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.displayName).toBe("Mobile Traveller");
    }
  });

  it("should reject registration with invalid email or short password", () => {
    const invalidData = {
      displayName: "Mobile Traveller",
      email: "invalid-email-address",
      password: "123"
    };

    const res = validateWithZod(RegisterRequestSchema, invalidData);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors.email).toBeDefined();
      expect(res.errors.password).toBeDefined();
    }
  });

  it("should validate mobile login credentials", () => {
    const res = validateWithZod(LoginRequestSchema, {
      email: "user@example.com",
      password: "Password123!"
    });
    expect(res.success).toBe(true);
  });

  it("should enforce password mismatch check on ChangePasswordRequestSchema", () => {
    const res = validateWithZod(ChangePasswordRequestSchema, {
      currentPassword: "CurrentPassword1!",
      newPassword: "NewPassword12345!",
      confirmPassword: "DifferentPassword!"
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors.confirmPassword).toMatch(/do not match/i);
    }
  });

  it("should require token in ResetPasswordRequestSchema", () => {
    const res = validateWithZod(ResetPasswordRequestSchema, {
      token: "",
      newPassword: "NewPassword12345!",
      confirmPassword: "NewPassword12345!"
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors.token).toBeDefined();
    }
  });
});

