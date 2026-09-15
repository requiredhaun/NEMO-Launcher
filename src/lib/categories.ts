export const CAT_LABELS: Record<string, string> = {
  adventure: 'Приключения',
  cursed: 'Шуточные',
  decoration: 'Декор',
  economy: 'Экономика',
  equipment: 'Снаряжение',
  food: 'Еда',
  'game-mechanics': 'Механики',
  library: 'Библиотеки',
  magic: 'Магия',
  management: 'Управление',
  minigame: 'Миниигры',
  mobs: 'Мобы',
  optimization: 'Оптимизация',
  social: 'Социальные',
  storage: 'Хранилища',
  technology: 'Технологии',
  transportation: 'Транспорт',
  utility: 'Утилиты',
  worldgen: 'Генерация мира',
}

export function catLabel(c: string): string {
  return CAT_LABELS[c] || c
}
