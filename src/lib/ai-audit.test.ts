import { afterEach, expect, it, vi } from "vitest";
import { completeAI, stripThinking } from "./ai";

afterEach(() => vi.unstubAllGlobals());

it("shows only the final answer after a local reasoning block", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ done_reason: "stop", message: { content: "Draft hidden</think>\nВідніміть 3 від обох частин." } }) }));
  expect(await completeAI({ provider: "ollama", model: "qwen3:4b" }, [{ role: "user", content: "Підказка" }])).toBe("Відніміть 3 від обох частин.");
});

it("rejects an unfinished local answer rather than showing its draft", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ done_reason: "length", message: { content: "Unfinished internal draft" } }) }));
  await expect(completeAI({ provider: "ollama", model: "qwen3:4b" }, [{ role: "user", content: "Підказка" }])).rejects.toThrow("не завершила");
});

it("does not display an unfinished explicitly tagged reasoning block", () => {
  expect(stripThinking("<think>not a final answer")).toBe("");
});
