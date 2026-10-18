import {expect,it,vi} from "vitest";import {z} from "zod";import {UserError,userFacingError} from "./errors";
it("keeps explicit user messages",()=>expect(userFacingError(new UserError("Немає доступу."))).toBe("Немає доступу."));
it("keeps the first validation issue",()=>{const parsed=z.string().min(2,"Вкажіть ім’я.").safeParse("");expect(!parsed.success&&userFacingError(parsed.error)).toBe("Вкажіть ім’я.");});
it("does not expose JSON parser internals",()=>expect(userFacingError(new SyntaxError("raw payload"))).toBe("Не вдалося прочитати JSON. Перевірте дужки, лапки та коми."));
it("logs unexpected errors without leaking Prisma details",()=>{const log=vi.spyOn(console,"error").mockImplementation(()=>{});try{const error=new Error("Prisma secret internal SQL");expect(userFacingError(error)).toBe("Не вдалося виконати дію.");expect(log).toHaveBeenCalledWith(error);}finally{log.mockRestore();}});
