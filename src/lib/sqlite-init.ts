type SQLiteClient={ $queryRawUnsafe(query:string):PromiseLike<unknown> };

/** One pooled connection: SQLite allows a single writer, and a second connection reports a 5s lock as Prisma P1008. */
export function sqliteConnectionUrl(raw:string):string;
export function sqliteConnectionUrl(raw:string|undefined):string|undefined;
export function sqliteConnectionUrl(raw:string|undefined){
 if(!raw?.startsWith("file:"))return raw;
 const [base,query=""]=raw.split("?");
 const params=new URLSearchParams(query);
 if(!params.has("connection_limit"))params.set("connection_limit","1");
 return `${base}?${params.toString()}`;
}

export async function initializeSQLite(client:SQLiteClient){
 try{await client.$queryRawUnsafe("PRAGMA journal_mode=WAL;");}catch(error){console.warn("Could not enable SQLite WAL",error);}
 try{await client.$queryRawUnsafe("PRAGMA busy_timeout=5000;");}catch(error){console.warn("Could not set SQLite busy timeout",error);}
}
