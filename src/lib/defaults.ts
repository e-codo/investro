// Заготовки нового пользователя. Всё редактируется в настройках.
// Тексты из старого проекта e-codo/invest, остальное из ТЗ (раздел 6).
export const DEFAULT_TEXTS = {
  title: "Моя стройка фундамента",
  subtitle: "Строю надёжно. Строю по плану. Без спешки.",
  quote: "«Большие стены складываются из маленьких кирпичей, если класть их регулярно»",
};
export const DEFAULT_CLASSES = [
  { name: "Облигации", weight: 60 },
  { name: "Акции", weight: 20 },
  { name: "Ликвидность", weight: 20 },
];
export const DEFAULT_GOAL_RUB = 3_000_000;
export const DEFAULT_MILESTONES_RUB = [100_000, 250_000, 500_000, 1_000_000, 2_000_000];
export const DEFAULT_DEPOSIT_RATE = 14;
export const DEFAULT_INFLATION = 6.5;
export const MAX_CLASSES = 5;
