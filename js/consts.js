// Order = stacking order in charts = categorical palette slot order (validated adjacent pairs).
export const KIND_ORDER = ['fuel', 'service', 'road', 'docs', 'fine', 'tires', 'repair', 'other'];
export const KINDS = {
  fuel:    { label: 'Заправка',           icon: 'fuel',           hint: 'Литры, цена, расход' },
  service: { label: 'ТО и обслуживание',  icon: 'wrench',         hint: 'Масло, фильтры, колодки' },
  repair:  { label: 'Ремонт',             icon: 'hammer',         hint: 'Что сломалось и починили' },
  docs:    { label: 'Страховка и тест',   icon: 'shield-check',   hint: 'Тест, лицензия, страховки' },
  tires:   { label: 'Шины',               icon: 'circle-dot',     hint: 'Комплект, шиномонтаж' },
  road:    { label: 'Парковка и дороги',  icon: 'square-parking', hint: 'Парковка, платные дороги' },
  fine:    { label: 'Штраф',              icon: 'triangle-alert', hint: 'Превышение, парковка' },
  other:   { label: 'Другое',             icon: 'ellipsis',       hint: 'Мойка, аксессуары' },
};
export const kindLabelShort = { fuel: 'Бензин', service: 'ТО', road: 'Дороги', docs: 'Документы', fine: 'Штрафы', tires: 'Шины', repair: 'Ремонт', other: 'Другое' };

export const TITLE_CHIPS = {
  service: ['Замена масла', 'Масляный фильтр', 'Воздушный фильтр', 'Салонный фильтр', 'Тормозные колодки', 'Свечи', 'Тормозная жидкость', 'Антифриз', 'Диагностика', 'Плановое ТО'],
  repair: ['Подвеска', 'Тормоза', 'Двигатель', 'Электрика', 'Кондиционер', 'Кузов', 'Стекло', 'Аккумулятор', 'Коробка', 'Выхлоп'],
  tires: ['Комплект шин', 'Шиномонтаж', 'Балансировка', 'Прокол', 'Сход-развал'],
  road: ['Парковка', 'Дорога 6', 'Платная дорога', 'Нетив Мааhир', 'Туннель'],
  fine: ['Превышение скорости', 'Парковка', 'Красный свет', 'Дорога 6'],
  other: ['Мойка', 'Омывайка', 'Коврики', 'Аксессуары', 'Эвакуатор'],
};
// Documents: tapping a chip also tells the reminder logic what it renews.
export const DOC_TYPES = [
  { key: 'test', title: 'Тест + лицензия (טסט)' },
  { key: 'ins_m', title: 'Страховка обязательная (חובה)' },
  { key: 'ins_c', title: 'Страховка комплексная (מקיף)' },
  { key: 'other', title: 'Другой документ' },
];
export const STATIONS = ['Paz', 'Sonol', 'Delek', 'Dor Alon', 'Ten'];
export const FUELS = [{ key: '95', label: '95' }, { key: '98', label: '98' }, { key: 'diesel', label: 'Солярка' }];

/* ---------- breakdowns: every label has Russian + Hebrew for the mechanic ---------- */
export const SEVERITY = {
  urgent: { ru: 'Срочно — опасно ехать', he: 'דחוף – מסוכן לנסוע', short: 'Срочно', icon: 'siren' },
  fix:    { ru: 'Нужно починить',        he: 'צריך לתקן',            short: 'Починить', icon: 'triangle-alert' },
  low:    { ru: 'Когда будет время',     he: 'כשיהיה זמן',           short: 'Не срочно', icon: 'clock' },
};
export const AREAS = [
  { key: 'engine', ru: 'Двигатель', he: 'מנוע' },
  { key: 'gear', ru: 'Коробка', he: 'תיבת הילוכים' },
  { key: 'brakes', ru: 'Тормоза', he: 'בלמים' },
  { key: 'susp', ru: 'Подвеска и руль', he: 'מתלים והגה' },
  { key: 'elec', ru: 'Электрика', he: 'חשמל' },
  { key: 'body', ru: 'Кузов', he: 'מרכב' },
  { key: 'cabin', ru: 'Салон и климат', he: 'פנים ומיזוג' },
  { key: 'wheels', ru: 'Шины и колёса', he: 'צמיגים וגלגלים' },
  { key: 'exhaust', ru: 'Выхлоп', he: 'מערכת פליטה' },
  { key: 'other', ru: 'Другое', he: 'אחר' },
];
export const CONDITIONS = [
  { key: 'cold', ru: 'На холодную', he: 'במנוע קר' },
  { key: 'warm', ru: 'На прогретом', he: 'במנוע חם' },
  { key: 'idle', ru: 'На холостых', he: 'בסרק' },
  { key: 'accel', ru: 'При разгоне', he: 'בהאצה' },
  { key: 'brake', ru: 'При торможении', he: 'בבלימה' },
  { key: 'turn', ru: 'На поворотах', he: 'בפניות' },
  { key: 'bumps', ru: 'На кочках', he: 'במהמורות' },
  { key: 'fast', ru: 'На скорости', he: 'במהירות גבוהה' },
  { key: 'slow', ru: 'На малой скорости', he: 'במהירות נמוכה' },
  { key: 'ac', ru: 'С кондиционером', he: 'בהפעלת מזגן' },
  { key: 'rain', ru: 'В дождь', he: 'בגשם' },
  { key: 'always', ru: 'Всегда', he: 'כל הזמן' },
];
export const SYMPTOMS = [
  { key: 'knock', ru: 'Стук', he: 'דפיקות' },
  { key: 'squeak', ru: 'Скрип', he: 'חריקה' },
  { key: 'grind', ru: 'Скрежет', he: 'שפשוף' },
  { key: 'vibr', ru: 'Вибрация', he: 'רעידות' },
  { key: 'whistle', ru: 'Свист', he: 'שריקה' },
  { key: 'hum', ru: 'Гул', he: 'זמזום' },
  { key: 'burn', ru: 'Запах гари', he: 'ריח שרוף' },
  { key: 'smoke', ru: 'Дым', he: 'עשן' },
  { key: 'leak', ru: 'Течь', he: 'דליפה' },
  { key: 'jerk', ru: 'Рывки', he: 'טלטולים' },
  { key: 'misfire', ru: 'Троит', he: 'המנוע מגמגם' },
  { key: 'hardstart', ru: 'Плохо заводится', he: 'קשה להתניע' },
  { key: 'stall', ru: 'Глохнет', he: 'המנוע נכבה' },
  { key: 'fuelhigh', ru: 'Большой расход', he: 'צריכת דלק גבוהה' },
  { key: 'overheat', ru: 'Перегрев', he: 'התחממות יתר' },
  { key: 'pull', ru: 'Уводит в сторону', he: 'הרכב מושך הצידה' },
  { key: 'heavysteer', ru: 'Тяжёлый руль', he: 'הגה כבד' },
  { key: 'weakbrake', ru: 'Слабо тормозит', he: 'בלימה חלשה' },
  { key: 'acnocool', ru: 'Не холодит кондиционер', he: 'המזגן לא מקרר' },
];
export const LIGHTS = [
  { key: 'check', ru: 'Check Engine', he: 'נורת Check Engine' },
  { key: 'abs', ru: 'ABS', he: 'נורת ABS' },
  { key: 'oil', ru: 'Давление масла', he: 'נורת לחץ שמן' },
  { key: 'batt', ru: 'Аккумулятор', he: 'נורת מצבר' },
  { key: 'airbag', ru: 'Подушки безопасности', he: 'נורת כרית אוויר' },
  { key: 'temp', ru: 'Температура', he: 'נורת טמפרטורה' },
  { key: 'tpms', ru: 'Давление в шинах', he: 'נורת לחץ אוויר בצמיגים' },
  { key: 'esp', ru: 'ESP', he: 'נורת ESP' },
  { key: 'brake', ru: 'Тормоза', he: 'נורת בלמים' },
];
export const byKey = (list, key) => list.find((x) => x.key === key);

export const HE = {
  title: 'רשימת תקלות לרכב',
  carDetails: 'פרטי הרכב', mileage: 'ק״מ', year: 'שנה', plate: 'מספר רכב', fuel: 'דלק',
  problems: 'תקלות', area: 'אזור', when: 'מתי קורה', symptoms: 'תסמינים', lights: 'נורות בלוח',
  seen: 'נצפה', details: 'פירוט', mechanicSaid: 'מה אמר המכונאי', recent: 'טיפולים ותיקונים אחרונים',
  lastService: 'טיפול אחרון', severity: 'דחיפות', noProblems: 'אין תקלות פתוחות', at: 'ב־',
};
export const RU = {
  title: 'Список неисправностей',
  carDetails: 'Автомобиль', mileage: 'Пробег', year: 'Год', plate: 'Номер', fuel: 'Топливо',
  problems: 'Неисправности', area: 'Узел', when: 'Когда проявляется', symptoms: 'Симптомы', lights: 'Индикаторы на панели',
  seen: 'Замечено', details: 'Описание', mechanicSaid: 'Что сказал мастер', recent: 'Недавние работы',
  lastService: 'Последнее ТО', severity: 'Срочность', noProblems: 'Открытых неисправностей нет', at: 'на ',
};
