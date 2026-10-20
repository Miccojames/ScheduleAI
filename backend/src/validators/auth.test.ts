import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "./auth.js";

// Core register/login cases only — required fields, obvious invalid inputs,
// and the documented normalization transforms.

const validRegister = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  password: "correct-horse-battery",
} as const;

describe("registerSchema", () => {
  it("accepts a valid payload", () => {
    expect(registerSchema.safeParse(validRegister).success).toBe(true);
  });

  it("trims and lowercases the email", () => {
    const result = registerSchema.safeParse({ ...validRegister, email: "  Ada@Example.COM  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("ada@example.com");
  });

  it("trims the names", () => {
    const result = registerSchema.safeParse({
      ...validRegister,
      firstName: "  Ada  ",
      lastName: "  Lovelace  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("Ada");
      expect(result.data.lastName).toBe("Lovelace");
    }
  });

  it("rejects missing required fields", () => {
    const { firstName: _f, ...withoutFirstName } = validRegister;
    expect(registerSchema.safeParse(withoutFirstName).success).toBe(false);

    const { lastName: _l, ...withoutLastName } = validRegister;
    expect(registerSchema.safeParse(withoutLastName).success).toBe(false);

    const { email: _e, ...withoutEmail } = validRegister;
    expect(registerSchema.safeParse(withoutEmail).success).toBe(false);

    const { password: _p, ...withoutPassword } = validRegister;
    expect(registerSchema.safeParse(withoutPassword).success).toBe(false);
  });

  it("rejects empty or whitespace-only names", () => {
    expect(registerSchema.safeParse({ ...validRegister, firstName: "" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegister, lastName: "   " }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(registerSchema.safeParse({ ...validRegister, email: "not-an-email" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegister, email: "ada@" }).success).toBe(false);
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(registerSchema.safeParse({ ...validRegister, password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegister, password: "12345678" }).success).toBe(true);
  });

  it("rejects passwords longer than 128 characters", () => {
    expect(registerSchema.safeParse({ ...validRegister, password: "x".repeat(129) }).success).toBe(
      false
    );
  });
});

describe("loginSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      loginSchema.safeParse({ email: "ada@example.com", password: "correct-horse-battery" })
        .success
    ).toBe(true);
  });

  it("trims and lowercases the email", () => {
    const result = loginSchema.safeParse({ email: "  Ada@Example.COM ", password: "pw" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("ada@example.com");
  });

  it("rejects a missing password", () => {
    const result = loginSchema.safeParse({ email: "ada@example.com" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "password")).toBe(true);
    }
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "ada@example.com", password: "" }).success).toBe(false);
  });

  it("rejects a missing or invalid email", () => {
    expect(loginSchema.safeParse({ password: "pw" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "nope", password: "pw" }).success).toBe(false);
  });
});
