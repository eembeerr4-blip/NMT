import {expect,it,vi} from "vitest";
import {initializeSQLite} from "./sqlite-init";
it("enables WAL and sets the SQLite busy timeout",async()=>{const query=vi.fn().mockResolvedValue([]);await initializeSQLite({$queryRawUnsafe:query});expect(query.mock.calls).toEqual([["PRAGMA journal_mode=WAL;"],["PRAGMA busy_timeout=5000;"]]);});
it("does not crash startup if a pragma fails and still tries the timeout",async()=>{const log=vi.spyOn(console,"warn").mockImplementation(()=>{});try{const query=vi.fn().mockRejectedValueOnce(new Error("readonly")).mockResolvedValueOnce([]);await expect(initializeSQLite({$queryRawUnsafe:query})).resolves.toBeUndefined();expect(query).toHaveBeenCalledTimes(2);expect(log).toHaveBeenCalledOnce();}finally{log.mockRestore();}});
