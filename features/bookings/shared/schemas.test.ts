import { describe, expect, it } from "vitest";
import { dayField, nameField, optionalDay, optionalPhone, optionalTime, pinField, requiredText } from "./schemas";

const error = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, value: unknown) =>
  schema.safeParse(value).error?.issues[0]?.message;

describe("booking form fields", () => {
  it("names: trimmed, 2 to 80 characters, any script", () => {
    expect(nameField.parse("  خالد المري ")).toBe("خالد المري");
    expect(error(nameField, "")).toBe("required");
    expect(error(nameField, "A")).toBe("tooShort");
    expect(error(nameField, "x".repeat(81))).toBe("tooLong");
  });

  it("phone: optional, digits typed in Arabic become 0-9", () => {
    expect(optionalPhone.parse("")).toBe("");
    expect(optionalPhone.parse(" ٥٥١٢٣٤٥٦ ")).toBe("55123456");
    expect(optionalPhone.parse("+974 5512 3456")).toBe("+974 5512 3456");
    expect(error(optionalPhone, "call me")).toBe("phone");
    expect(error(optionalPhone, "123")).toBe("phone");
  });

  it("days and hours", () => {
    expect(dayField.parse("2031-03-10")).toBe("2031-03-10");
    expect(error(dayField, "")).toBe("required");
    expect(optionalDay.parse("")).toBe("");
    expect(error(optionalDay, "10/03/2031")).toBe("invalid");
    expect(optionalTime.parse("16:30")).toBe("16:30");
    expect(optionalTime.parse("")).toBe("");
    expect(error(optionalTime, "25:00")).toBe("invalid");
  });

  it("required text and the PIN", () => {
    expect(error(requiredText(200), "   ")).toBe("required");
    expect(error(requiredText(5), "too long")).toBe("tooLong");
    expect(pinField.parse("٤٨٢٩١٥")).toBe("482915");
    expect(error(pinField, "12345")).toBe("pin");
  });
});
