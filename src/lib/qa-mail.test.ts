import { afterEach, describe, expect, it } from "vitest";
import { isQaMailSinkEnabled } from "./qa-mail";

const env = process.env;

afterEach(() => {
  process.env = { ...env };
});

describe("isQaMailSinkEnabled", () => {
  it("stays disabled on public HTTPS even if QA endpoint is set", () => {
    process.env.AUTH_BASE_URL = "https://academy.example.com";
    process.env.AUTH_MAIL_QA_ENDPOINT = "http://127.0.0.1:3010/api/internal/qa-mail";
    expect(isQaMailSinkEnabled()).toBe(false);
  });

  it("enables only for localhost HTTP app and matching sink path", () => {
    process.env.AUTH_BASE_URL = "http://127.0.0.1:3010";
    process.env.AUTH_MAIL_QA_ENDPOINT = "http://127.0.0.1:3010/api/internal/qa-mail";
    expect(isQaMailSinkEnabled()).toBe(true);
  });

  it("rejects wrong sink path or missing base URL", () => {
    process.env.AUTH_BASE_URL = "http://127.0.0.1:3010";
    process.env.AUTH_MAIL_QA_ENDPOINT = "http://127.0.0.1:3010/api/other";
    expect(isQaMailSinkEnabled()).toBe(false);
    delete process.env.AUTH_BASE_URL;
    process.env.AUTH_MAIL_QA_ENDPOINT = "http://127.0.0.1:3010/api/internal/qa-mail";
    expect(isQaMailSinkEnabled()).toBe(false);
  });
});
