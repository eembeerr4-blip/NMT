-- Предложение, НЕ выполнялось на рабочей базе.
-- Снимок 18.10.2026: найдено 0 DROPPED custom-/moved-; UPDATE не требуется.
-- Перед любым будущим восстановлением: свежий согласованный backup и решение владельца.
-- Нельзя восстанавливать все DROPPED без доказательства причины и проверки перенесённых преемников.
SELECT id, userId, dateKey, status, templateKey, movedFromId
FROM StudyTask
WHERE status = 'DROPPED'
  AND (templateKey LIKE 'custom-%' OR templateKey LIKE 'moved-%');
