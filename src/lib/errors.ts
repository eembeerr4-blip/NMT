import {ZodError} from "zod";
export class UserError extends Error {}
export function userFacingError(error:unknown):string{
 if(error instanceof UserError)return error.message;
 if(error instanceof ZodError)return error.issues[0]?.message??"Перевірте поля форми.";
 if(error instanceof SyntaxError)return "Не вдалося прочитати JSON. Перевірте дужки, лапки та коми.";
 console.error(error);
 return "Не вдалося виконати дію.";
}
