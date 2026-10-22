import { describe, expect, it } from "vitest";
import { jacketAdvice } from "@/components/WeatherCard";

describe("jacket advice", () => {
  it("no jacket when it's warm", () => expect(jacketAdvice(26, 20)).toBe("none"));
  it("light jacket when mild", () => expect(jacketAdvice(18, 14)).toBe("light"));
  it("medium jacket when cool", () => expect(jacketAdvice(11, 9)).toBe("medium"));
  it("heavy jacket when cold", () => expect(jacketAdvice(3, 0)).toBe("heavy"));
});
