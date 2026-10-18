import {expect,it} from "vitest";
import {dateKey,parseDateKey} from "./dates";

it.each(["2026-02-31","2025-02-29","2026-04-31","2026-00-10","2026-13-01","2026-01-00","2026-1-01","2026-01-01extra",""])("A10 rejects impossible or malformed calendar date %s",value=>{
 expect(()=>parseDateKey(value)).toThrow();
});
it.each(["2024-02-29","2026-02-28","2026-12-31","0100-01-01"])("A10 preserves valid calendar date %s",value=>{
 expect(dateKey(parseDateKey(value))).toBe(value);
});
