import { describe, it, expect } from "vitest";
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  ChangePasswordRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema
} from "@luggage-storage/contracts";
import { validateWithZod } from "../src/lib/validation";

describe("Validation Helper & Zod Contracts Integration", () => {
  describe("RegisterRequestSchema", () => {
    it("should accept valid registration input", () => {
      const input = {
        displayName: "John Doe",
        email: "john.doe@example.com",
        password: "StrongPassword123!",
        phoneNumber: "+1234567890"
      };

      const result = validateWithZod(RegisterRequestSchema, input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("john.doe@example.com");
      }
    });

    it("should reject invalid email format", () => {
      const input = {
        displayName: "John Doe",
        email: "not-an-email",
        password: "StrongPassword123!"
      };

      const result = validateWithZod(RegisterRequestSchema, input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email).toBeDefined();
      }
    });

    it("should reject password shorter than 8 characters", () => {
      const input = {
        displayName: "John Doe",
        email: "john@example.com",
        password: "short"
      };

      const result = validateWithZod(RegisterRequestSchema, input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.password).toBeDefined();
      }
    });
  });

  describe("LoginRequestSchema", () => {
    it("should accept valid login input", () => {
      const input = {
        email: "valid@example.com",
        password: "Password123!"
      };

      const result = validateWithZod(LoginRequestSchema, input);
      expect(result.success).toBe(true);
    });

    it("should reject empty password", () => {
      const input = {
        email: "valid@example.com",
        password: ""
      };

      const result = validateWithZod(LoginRequestSchema, input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.password).toBeDefined();
      }
    });
  });

  describe("ChangePasswordRequestSchema", () => {
    it("should accept valid password change with matching new passwords", () => {
      const input = {
        currentPassword: "OldPassword123!",
        newPassword: "BrandNewPassword456!",
        confirmPassword: "BrandNewPassword456!"
      };

      const result = validateWithZod(ChangePasswordRequestSchema, input);
      expect(result.success).toBe(true);
    });

    it("should reject when new password and confirm password do not match", () => {
      const input = {
        currentPassword: "OldPassword123!",
        newPassword: "BrandNewPassword456!",
        confirmPassword: "DifferentPassword789!"
      };

      const result = validateWithZod(ChangePasswordRequestSchema, input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.confirmPassword).toMatch(/do not match/i);
      }
    });

    it("should reject when new password is identical to current password", () => {
      const input = {
        currentPassword: "IdenticalPassword123!",
        newPassword: "IdenticalPassword123!",
        confirmPassword: "IdenticalPassword123!"
      };

      const result = validateWithZod(ChangePasswordRequestSchema, input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.newPassword).toMatch(/cannot be the same/i);
      }
    });
  });

  describe("ForgotPasswordRequestSchema & ResetPasswordRequestSchema", () => {
    it("should accept valid forgot password email", () => {
      const input = { email: "user@example.com" };
      const result = validateWithZod(ForgotPasswordRequestSchema, input);
      expect(result.success).toBe(true);
    });

    it("should accept valid password reset with token and matching passwords", () => {
      const input = {
        token: "valid-reset-token-abc123",
        newPassword: "SecurePassword999!",
        confirmPassword: "SecurePassword999!"
      };

      const result = validateWithZod(ResetPasswordRequestSchema, input);
      expect(result.success).toBe(true);
    });

    it("should reject reset with missing token", () => {
      const input = {
        token: "",
        newPassword: "SecurePassword999!",
        confirmPassword: "SecurePassword999!"
      };

      const result = validateWithZod(ResetPasswordRequestSchema, input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.token).toBeDefined();
      }
    });
  });
});

