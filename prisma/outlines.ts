export const outlines = [
  ["ukrainian-literature", "Усна народна творчість", "Давня література", "Нова українська література", "Література XX століття", "Сучасна література"],
  ["english", "Reading", "Grammar", "Vocabulary", "Listening", "Writing"],
  ["german", "Lesen", "Grammatik", "Wortschatz", "Hören", "Schreiben"],
  ["french", "Compréhension écrite", "Grammaire", "Lexique", "Compréhension orale", "Expression écrite"],
  ["spanish", "Comprensión lectora", "Gramática", "Léxico", "Comprensión auditiva", "Expresión escrita"],
  ["geography", "Загальна географія", "Географія України", "Населення і господарство", "Регіони світу", "Картографія"],
  ["physics", "Механіка", "Молекулярна фізика", "Електрика", "Коливання і хвилі", "Квантова фізика"],
  ["chemistry", "Загальна хімія", "Неорганічна хімія", "Органічна хімія", "Розрахункові задачі", "Хімічний зв'язок"],
].flatMap(([subjectId, ...titles]) =>
  titles.map((title, index) => ({
    id: `${subjectId}-${index + 1}`,
    subjectId,
    title,
    summary: "Матеріали цієї теми ще не додані. Це каркас шкільної програми, не офіційний текст НМТ.",
    sortOrder: (index + 1) * 10,
    coverage: "NEEDS_CONTENT",
  })),
);
