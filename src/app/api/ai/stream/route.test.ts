import { beforeEach, expect, it, vi } from "vitest";
const mock=vi.hoisted(()=>({user:vi.fn(),settings:vi.fn(),complete:vi.fn(),probe:vi.fn(),create:vi.fn(),messages:vi.fn()}));
vi.mock("@/server/session",()=>({getSessionUser:mock.user}));
vi.mock("@/server/sync",()=>({getSettings:mock.settings}));
vi.mock("@/lib/secrets",()=>({readSecrets:()=>({ollamaBaseUrl:"http://127.0.0.1:11434"})}));
vi.mock("@/lib/ai",()=>({completeAI:mock.complete,probeOllama:mock.probe}));
vi.mock("@/lib/prisma",()=>({prisma:{topic:{findUnique:vi.fn(async()=>({title:"Рівняння",summary:"Алгебра"}))},aIConversation:{create:mock.create},aIMessage:{createMany:mock.messages}}}));
import { POST } from "./route";
beforeEach(()=>{vi.resetAllMocks();mock.user.mockResolvedValue({id:"learner"});mock.settings.mockResolvedValue({aiProvider:"none",aiModel:""});mock.probe.mockResolvedValue({ok:true,preferred:"test-model"});mock.create.mockResolvedValue({id:"conversation"});mock.complete.mockResolvedValue("Готове пояснення");});
const request=(body:unknown)=>new Request("http://localhost/api/ai/stream",{method:"POST",body:JSON.stringify(body)});
it("requires a live learner session",async()=>{mock.user.mockResolvedValue(null);expect((await POST(request({prompt:"Поясни"}))).status).toBe(401)});
it("rejects malformed JSON, non-string and oversized prompts",async()=>{
 expect((await POST(new Request("http://localhost/api/ai/stream",{method:"POST",body:"{"}))).status).toBe(400);
 expect((await POST(request({prompt:123}))).status).toBe(400);
 expect((await POST(request({prompt:"x".repeat(6001)}))).status).toBe(400);
});
it("gives a useful error without a configured provider",async()=>{const response=await POST(request({prompt:"Поясни"}));expect(response.status).toBe(400);expect(await response.text()).toContain("вимкнено")});
it("routes all lesson modes and saves only completed responses under the learner",async()=>{
 mock.settings.mockResolvedValue({aiProvider:"ollama",aiModel:"test-model"});
 for(const mode of ["explain","unclear","simpler","example","steps","hint","check"]){const response=await POST(request({mode,prompt:"2x+3=11"}));expect(response.status).toBe(200);expect(await response.json()).toEqual({text:"Готове пояснення"});}
 expect(mock.complete).toHaveBeenCalledTimes(7);expect(mock.create).toHaveBeenCalledWith({data:expect.objectContaining({userId:"learner"})});
 const hint=mock.complete.mock.calls[5][1][1].content;expect(hint).toContain("Не повідомляй кінцеву відповідь");
});
it("handles a disconnected local provider",async()=>{mock.settings.mockResolvedValue({aiProvider:"ollama",aiModel:"test-model"});mock.probe.mockResolvedValue({ok:false,reason:"Ollama зараз не запущена."});expect((await POST(request({prompt:"Поясни"}))).status).toBe(503);expect(mock.create).not.toHaveBeenCalled()});
it("does not save aborted generation",async()=>{mock.settings.mockResolvedValue({aiProvider:"ollama",aiModel:"test-model"});mock.complete.mockRejectedValue(new DOMException("Aborted","AbortError"));expect((await POST(request({prompt:"Поясни"}))).status).toBe(503);expect(mock.create).not.toHaveBeenCalled()});
