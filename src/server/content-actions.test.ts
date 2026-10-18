import {beforeEach,describe,expect,it,vi} from "vitest";
const mock=vi.hoisted(()=>({user:vi.fn(),update:vi.fn(),audit:vi.fn(),transaction:vi.fn()}));
vi.mock("@/server/session",()=>({getSessionUser:mock.user}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{$transaction:mock.transaction}}));
import {saveSubjectDetails} from "./content-actions";
const input={id:"math",name:"Математика",shortName:"Математика",description:"Перевірка на тестових даних"};
beforeEach(()=>{vi.resetAllMocks();mock.transaction.mockImplementation(async change=>change({subject:{update:mock.update},auditLog:{create:mock.audit}}));});
describe("subject editing permissions",()=>{
 it("rejects unauthenticated callers and students before accessing shared content",async()=>{for(const user of [null,{id:"student",role:"STUDENT"}]){mock.user.mockResolvedValue(user);expect((await saveSubjectDetails(input)).ok).toBe(false);}expect(mock.transaction).not.toHaveBeenCalled();});
 it("allows owners, administrators and editors and journals the subject id",async()=>{for(const role of ["OWNER","ADMIN","EDITOR"]){mock.user.mockResolvedValue({id:"test-staff",role});expect((await saveSubjectDetails(input)).ok).toBe(true);}expect(mock.update).toHaveBeenCalledWith({where:{id:"math"},data:{name:input.name,shortName:input.shortName,description:input.description}});expect(mock.audit).toHaveBeenCalledWith({data:expect.objectContaining({action:"SUBJECT_UPDATED",entityType:"subject",entityId:"math"})});});
 it("validates input before starting a transaction",async()=>{mock.user.mockResolvedValue({id:"owner",role:"ADMIN"});expect((await saveSubjectDetails({...input,name:""})).ok).toBe(false);expect(mock.transaction).not.toHaveBeenCalled();});
 it("does not record a successful event when persistence fails",async()=>{mock.user.mockResolvedValue({id:"editor",role:"EDITOR"});mock.update.mockRejectedValue(new Error("storage unavailable"));expect((await saveSubjectDetails(input)).ok).toBe(false);expect(mock.audit).not.toHaveBeenCalled();});
});
