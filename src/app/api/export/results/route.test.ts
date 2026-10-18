import {beforeEach,expect,it,vi} from "vitest";
const mock=vi.hoisted(()=>({user:vi.fn(),query:vi.fn()}));
vi.mock("@/server/session",()=>({getSessionUser:mock.user}));
vi.mock("@/lib/prisma",()=>({prisma:{examResult:{findMany:mock.query}}}));
import {GET} from "./route";
beforeEach(()=>vi.resetAllMocks());
it("C09: absent or expired sessions get JSON 401 before any private query",async()=>{
 mock.user.mockResolvedValue(null);const response=await GET();expect(response.status).toBe(401);expect(response.headers.get("Content-Type")).toContain("application/json");expect(await response.json()).toMatchObject({error:expect.any(String)});expect(mock.query).not.toHaveBeenCalled();
});
it("CSV results only query the current user's records",async()=>{
 mock.user.mockResolvedValue({id:"QA-B"});mock.query.mockResolvedValue([]);const response=await GET();expect(response.status).toBe(200);expect(mock.query).toHaveBeenCalledWith(expect.objectContaining({where:{userId:"QA-B"}}));
});
