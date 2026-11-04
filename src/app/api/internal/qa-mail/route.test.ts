import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const env = process.env;

afterEach(() => {
  process.env = { ...env };
});

describe("POST /api/internal/qa-mail", () => {
  it("returns 404 when sink is not enabled (production-style base URL)", async () => {
    process.env.AUTH_BASE_URL = "https://academy.example.com";
    process.env.AUTH_MAIL_QA_ENDPOINT = "http://127.0.0.1:3010/api/internal/qa-mail";
    const response = await POST(new Request("http://127.0.0.1/api/internal/qa-mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: "secret-token=leak" }),
    }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not found" });
  });

  it("does not echo email payloads when enabled", async () => {
    process.env.AUTH_BASE_URL = "http://127.0.0.1:3010";
    process.env.AUTH_MAIL_QA_ENDPOINT = "http://127.0.0.1:3010/api/internal/qa-mail";
    const response = await POST(new Request("http://127.0.0.1:3010/api/internal/qa-mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Open http://127.0.0.1:3010/verify-email?token=super-secret",
      }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ id: "qa-mail-stub" });
    expect(JSON.stringify(body)).not.toContain("super-secret");
  });
});
