type SQLiteClient={ $queryRawUnsafe(query:string):PromiseLike<unknown> };
export async function initializeSQLite(client:SQLiteClient){
 try{await client.$queryRawUnsafe("PRAGMA journal_mode=WAL;");}catch(error){console.warn("Could not enable SQLite WAL",error);}
 try{await client.$queryRawUnsafe("PRAGMA busy_timeout=5000;");}catch(error){console.warn("Could not set SQLite busy timeout",error);}
}
