import {expect,it} from "vitest";
import {hashPassword,hashPasswordAsync,verifyPassword,verifyPasswordAsync,DUMMY_HASH} from "./auth";
it("keeps synchronous hashes compatible with asynchronous verification",async()=>{expect(await verifyPasswordAsync("correct",hashPassword("correct"))).toBe(true);expect(await verifyPasswordAsync("wrong",hashPassword("correct"))).toBe(false);});
it("keeps async hashes compatible with synchronous scripts",async()=>{const hash=await hashPasswordAsync("correct");expect(verifyPassword("correct",hash)).toBe(true);expect(await verifyPasswordAsync("wrong",DUMMY_HASH)).toBe(false);});
