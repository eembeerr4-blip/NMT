import { describe, expect, it } from "vitest";
import { canEditContent, canManageRole, effectiveRole, isAdministrator, isOwner, ROLE_ORDER } from "./permissions";
const owner={id:"original",role:"OWNER"};
const admin={id:"admin",role:"ADMIN"};
const student={id:"student",role:"STUDENT"};
describe("role hierarchy",()=>{
 it("orders roles from owner to student",()=>expect(ROLE_ORDER).toEqual(["OWNER","ADMIN","EDITOR","STUDENT"]));
 it("recognizes assigned owners and preserves the original owner without changing its data",()=>{
  expect(isOwner(owner)).toBe(true);expect(isAdministrator(owner)).toBe(true);expect(canEditContent(owner)).toBe(true);
  expect(effectiveRole({id:"owner",role:"ADMIN"})).toBe("OWNER");
 });
 it("lets an owner assign every role to another regular profile",()=>{
  for(const role of ROLE_ORDER)expect(canManageRole(owner,student,role)).toBe(true);
 });
 it("protects the original owner and the current profile",()=>{
  for(const role of ROLE_ORDER){expect(canManageRole(owner,{id:"owner",role:"ADMIN"},role)).toBe(false);expect(canManageRole(owner,owner,role)).toBe(false);}
 });
 it("lets admins manage only lower roles",()=>{
  expect(canManageRole(admin,student,"EDITOR")).toBe(true);expect(canManageRole(admin,{id:"editor",role:"EDITOR"},"STUDENT")).toBe(true);
  expect(canManageRole(admin,student,"OWNER")).toBe(false);expect(canManageRole(admin,student,"ADMIN")).toBe(false);
  expect(canManageRole(admin,owner,"STUDENT")).toBe(false);expect(canManageRole(admin,{id:"other-admin",role:"ADMIN"},"STUDENT")).toBe(false);
 });
 it("allows content editing without granting editors administration or role changes",()=>{
  const editor={id:"editor",role:"EDITOR"};expect(canEditContent(editor)).toBe(true);expect(isAdministrator(editor)).toBe(false);
  expect(canManageRole(editor,student,"STUDENT")).toBe(false);
 });
 it("denies unknown roles and ordinary students staff access",()=>{
  for(const user of [student,{id:"unknown",role:"SUPERUSER"}]){expect(isAdministrator(user)).toBe(false);expect(canEditContent(user)).toBe(false);expect(canManageRole(user,owner,"STUDENT")).toBe(false);}
 });
});
