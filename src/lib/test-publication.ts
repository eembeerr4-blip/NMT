export const PUBLICATION_LABEL={DRAFT:"Чернетка",PUBLISHED:"Опубліковано",ARCHIVED:"Архів"} as const;
export type Publication=keyof typeof PUBLICATION_LABEL;
export function testConfig(json:string):Record<string,unknown> {try{const value=JSON.parse(json);return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}catch{return {};}}
export function testPublication(json:string):Publication {const value=testConfig(json).publication;return value==="PUBLISHED"||value==="ARCHIVED"?value:"DRAFT";}
export function publicationConfig(json:string,publication:Publication) {return JSON.stringify({...testConfig(json),publication});}
