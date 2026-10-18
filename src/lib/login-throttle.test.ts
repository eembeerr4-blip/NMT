import {afterEach,expect,it,vi} from "vitest";
import {isLocked,registerFail,clearFails} from "./login-throttle";
afterEach(()=>vi.useRealTimers());
it("locks after five failures",()=>{clearFails("five");for(let i=0;i<4;i++)registerFail("five");expect(isLocked("five")).toBe(false);registerFail("five");expect(isLocked("five")).toBe(true);});
it("clears after success",()=>{for(let i=0;i<5;i++)registerFail("success");clearFails("success");expect(isLocked("success")).toBe(false);});
it("resets after the failure window",()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-18T10:00:00Z"));for(let i=0;i<5;i++)registerFail("window");vi.advanceTimersByTime(15*60*1000+1);expect(isLocked("window")).toBe(false);registerFail("window");expect(isLocked("window")).toBe(false);});
