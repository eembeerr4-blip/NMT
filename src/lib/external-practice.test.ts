import { expect, it } from "vitest";
import { znoCatalog, variantsFor, safeZnoUrl, nextVariant, practiceSchedule, externalResultSchema, variantCatalogMessage, topicCoverageLabel } from "./external-practice";
import mappings from "./zno-topic-map.json";
import curriculum from "../../prisma/content/nmt-curriculum-map.v1.json";
it("contains only followed public URLs and five subjects; question counts are not raw-score maxima",()=>{
  expect(znoCatalog.variants).toHaveLength(129);
  expect(znoCatalog.collections).toHaveLength(255);
  expect(new Set(znoCatalog.variants.map(v=>v.url)).size).toBe(129);
  for(const [id,total] of Object.entries({ukrainian:29,math:45,history:29,geography:8,biology:18})) {
    const rows=variantsFor(id); expect(rows).toHaveLength(total);
    expect(rows.map(v=>v.number)).toEqual(Array.from({length:total},(_,i)=>i+1));
    expect(rows.every(v=>safeZnoUrl(v.url)&&v.questionCount===(id==="math"?22:30))).toBe(true);
  }
  expect(variantsFor("english")).toEqual([]);
});
it.each(["https://zno.osvita.ua.evil.test/a","http://zno.osvita.ua/a","javascript:alert(1)","https://evil.test","https://x@zno.osvita.ua/a","https://zno.osvita.ua:444/a","https://zno.osvita.ua/","https://zno.osvita.ua/a?redirect=https://evil.test"])("rejects unsafe provider URL %s",url=>expect(safeZnoUrl(url)).toBe(false));
it("does not invent a next variant after catalog exhaustion",()=>{
  expect(nextVariant("math",[1])?.number).toBe(2);
  expect(nextVariant("geography",[1,2,3,4,5,6,7,8])).toBeUndefined();
});
it("explicitly covers all 288 canonical topics without general-link fallbacks",()=>{
  const ids=curriculum.subjects.flatMap(s=>s.sections.flatMap(sec=>sec.topics.map(t=>t.id))).sort();
  expect(mappings.topics.map(t=>t.topicId).sort()).toEqual(ids);
  for(const t of mappings.topics) for(const l of t.links) {
    expect(znoCatalog.collections.some(c=>c.subjectId===t.subjectId&&c.url===l.url)).toBe(true);
    expect(l.coverage).toMatch(/^(EXACT|NARROWER|BROADER|OVERLAPPING|UNCERTAIN)$/);
    expect(l.url).not.toMatch(/\/(tema|nmt|list|rq)\.html$/);
  }
  expect(mappings.topics.find(t=>t.topicId==="ukr-lex-02-syn-ant-hom")?.links).toHaveLength(3);
  expect(mappings.topics.find(t=>t.topicId==="math-linear-eq")?.links[0].coverage).toBe("BROADER");
  expect(mappings.topics.some(t=>!t.links.length)).toBe(true);
});
it("keeps old users opted out until they choose a schedule",()=>expect(practiceSchedule({})).toEqual({enabled:false,days:[],durationMin:60}));
it("validates actual dates and never derives max score from question count",()=>{
  const data={assignmentId:"qa",version:0,date:"2026-10-27",rawScore:27,maxRawScore:null,ratingScore:null,errorCount:0,comment:""};
  expect(externalResultSchema.parse(data).maxRawScore).toBeNull();
  expect(externalResultSchema.safeParse({...data,date:"2026-02-30"}).success).toBe(false);
  expect(externalResultSchema.safeParse({...data,maxRawScore:20}).success).toBe(false);
  expect(externalResultSchema.safeParse({...data,ratingScore:201}).success).toBe(false);
});

it("distinguishes empty, unstarted, pending, and genuinely processed catalogs",()=>{const original=[...znoCatalog.variants];try{znoCatalog.variants.splice(0);expect(variantCatalogMessage("math",[])).toContain("Підтверджених варіантів поки немає");znoCatalog.variants.push(...original);expect(variantCatalogMessage("math",[])).toContain("ще не починали");expect(variantCatalogMessage("math",[{subjectId:"math",variantNumber:1,status:"PAUSED"}])).toContain("незавершений");expect(variantCatalogMessage("math",variantsFor("math").map(v=>({subjectId:"math",variantNumber:v.number,status:"SKIPPED"})))).toContain("Усі доступні варіанти");}finally{znoCatalog.variants.splice(0,znoCatalog.variants.length,...original)}});
it("labels every coverage relation explicitly and preserves all URLs",()=>{expect(mappings.topics.flatMap(t=>t.links)).toHaveLength(356);expect(new Set(mappings.topics.flatMap(t=>t.links.map(l=>l.url))).size).toBe(246);expect(mappings.topics.filter(t=>t.status==="MISSING")).toHaveLength(10);expect(mappings.topics.find(t=>t.topicId==="ukr-lex-02-syn-ant-hom")!.links.slice(0,2).every(l=>l.coverage==="NARROWER")).toBe(true);expect(new Set(["EXACT","NARROWER","BROADER","OVERLAPPING","UNCERTAIN"].map(topicCoverageLabel)).size).toBe(5);expect(topicCoverageLabel("UNKNOWN")).toContain("уточнення");});
