import {beforeEach,describe,expect,it,vi} from "vitest";
const mock=vi.hoisted(()=>({user:vi.fn(),backup:vi.fn()}));
vi.mock("@/server/session",()=>({getSessionUser:mock.user}));
vi.mock("@/server/actions",()=>({buildBackup:mock.backup}));
import {GET} from "./route";
beforeEach(()=>vi.resetAllMocks());
describe("full backup API",()=>{
 it("requires authentication",async()=>{mock.user.mockResolvedValue(null);expect((await GET()).status).toBe(401);expect(mock.backup).not.toHaveBeenCalled();});
 it("denies students, editors and administrators before reading backup data",async()=>{for(const role of ["STUDENT","EDITOR","ADMIN"]){mock.user.mockResolvedValue({id:"staff",role});expect((await GET()).status).toBe(403);}expect(mock.backup).not.toHaveBeenCalled();});
 it("allows both the fixed owner and an assigned owner",async()=>{mock.backup.mockResolvedValue({version:3});for(const user of [{id:"owner",role:"ADMIN"},{id:"assigned-owner",role:"OWNER"}]){mock.user.mockResolvedValue(user);const response=await GET();expect(response.status).toBe(200);expect(response.headers.get("Content-Disposition")).toContain("attachment");}expect(mock.backup).toHaveBeenCalledTimes(2);});
});
