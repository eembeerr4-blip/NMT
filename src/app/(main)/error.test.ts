import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it,vi} from "vitest";
import ErrorPage from "./error";
import Loading from "./loading";
it("student error state never renders database, stack or credential details",()=>{
 const html=renderToStaticMarkup(createElement(ErrorPage,{error:new Error("SELECT passwordHash FROM Session -- QA-private"),reset:vi.fn()}));
 expect(html).not.toContain("passwordHash");expect(html).not.toContain("QA-private");expect(html).toContain("Спробувати знову");
});
it("loading is announced to assistive technology",()=>{
 const html=renderToStaticMarkup(createElement(Loading));expect(html).toContain('role="status"');expect(html).toContain("Завантаження");
});
