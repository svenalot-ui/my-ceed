import { addDays, addMonths, today, uid, round } from './util.js';

/** Fake but realistic data for ?demo — lives in a separate database. */
export async function seedDemo({ S, db, saveSettings }) {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const t = today();
  const entries = [];
  const add = (e) => entries.push({ id: uid(), photos: [], createdAt: Date.parse(e.date), ...e });

  const brands = [['Paz', 0.08], ['Sonol', 0.04], ['Delek', 0], ['Dor Alon', -0.08], ['Ten', -0.14]];
  let date = addDays(t, -430), odo = 71400, n = 0;
  const fuel = [];
  while (true) {
    date = addDays(date, 6 + Math.floor(rnd() * 6));
    if (date > addDays(t, -2)) break;
    const dist = Math.round(360 + rnd() * 230); odo += dist;
    const l100 = 7.1 + rnd() * 1.5 + (n % 9 === 0 ? 0.8 : 0);
    const liters = round((dist * l100) / 100, 2);
    const [station, off] = brands[Math.floor(rnd() * brands.length)];
    const ppl = round(7.15 + 0.45 * Math.sin(n / 7) + off + (rnd() - 0.5) * 0.12, 2);
    fuel.push({ date, odo });
    add({ kind: 'fuel', date, odo, liters, ppl, total: round(liters * ppl, 2), full: true, station, fuel: '95', title: 'Заправка' });
    n++;
  }
  const odoOn = (d) => {
    let best = fuel[0];
    for (const f of fuel) if (f.date <= d) best = f;
    return best.odo;
  };
  const ev = (days, kind, title, total, extra = {}) => {
    const d = addDays(t, -days);
    const e = { kind, date: d, odo: odoOn(d), total, title, ...extra };
    add(e); return entries[entries.length - 1];
  };

  const svc = ev(300, 'service', 'Плановое ТО 60 000', 1380, { place: 'Сервис Киа, Хайфа', note: 'Масло, фильтры, свечи, диагностика' });
  ev(120, 'service', 'Тормозные колодки спереди', 790, { place: 'Гараж Миша' });
  const rep = ev(140, 'repair', 'Стойка стабилизатора (перед справа)', 420, { place: 'Гараж Миша', note: 'Был стук на кочках' });
  ev(90, 'tires', 'Комплект шин 205/55 R16', 2380, { place: 'Шины Дорон' });
  ev(90, 'tires', 'Балансировка и монтаж', 240);
  const test = ev(330, 'docs', 'Тест + лицензия (טסט)', 1260, { docType: 'test', validUntil: addMonths(addDays(t, -330), 12) });
  ev(200, 'docs', 'Страховка обязательная (חובה)', 1890, { docType: 'ins_m', validUntil: addMonths(addDays(t, -200), 12) });
  ev(200, 'docs', 'Страховка комплексная (מקיף)', 2750, { docType: 'ins_c', validUntil: addMonths(addDays(t, -200), 12) });
  ev(75, 'fine', 'Превышение скорости', 500);
  [260, 220, 181, 150, 113, 77, 52, 31, 12].forEach((d, i) => ev(d, 'road', i % 3 === 0 ? 'Дорога 6' : 'Парковка', i % 3 === 0 ? 26.4 + (i % 2) : 12 + (i % 4) * 6));
  [250, 170, 95, 40, 8].forEach((d) => ev(d, 'other', 'Мойка', 50 + (d % 3) * 10));

  const issues = [
    { id: uid(), title: 'Стук спереди справа на кочках', status: 'fixed', severity: 'fix', area: 'susp', symptoms: ['knock'], conditions: ['bumps', 'slow'], lights: [], desc: 'Слышно на лежачих полицейских и на плохой дороге.', date: addDays(t, -165), odo: odoOn(addDays(t, -165)), photos: [], fixedDate: rep.date, fixedBy: rep.id, mechanic: 'Стойка стабилизатора, заменили' },
    { id: uid(), title: 'Скрип при торможении', status: 'open', severity: 'fix', area: 'brakes', symptoms: ['squeak', 'weakbrake'], conditions: ['brake', 'cold'], lights: [], desc: 'Особенно по утрам, первые 5–10 торможений. Педаль мягче, чем была.', date: addDays(t, -9), odo: odoOn(addDays(t, -9)), photos: [] },
    { id: uid(), title: 'Загорался Check Engine на 2 минуты', status: 'open', severity: 'urgent', area: 'engine', symptoms: ['misfire'], conditions: ['warm', 'accel'], lights: ['check'], desc: 'После заправки на трассе, потом погас сам. Машина слегка дёргалась.', date: addDays(t, -3), odo: odoOn(addDays(t, -3)), photos: [] },
    { id: uid(), title: 'Кондиционер слабо холодит', status: 'open', severity: 'low', area: 'cabin', symptoms: ['acnocool'], conditions: ['ac', 'idle'], lights: [], desc: 'На ходу нормально, в пробке тёплый воздух.', date: addDays(t, -30), odo: odoOn(addDays(t, -30)), photos: [] },
  ];

  for (const e of entries) await db.put('entries', e);
  for (const i of issues) await db.put('issues', i);
  S.entries = entries; S.issues = issues;
  const rs = S.settings.reminders.map((r) => ({ ...r }));
  const R = (k) => rs.find((r) => r.key === k);
  R('test').dueDate = test.validUntil;
  R('ins_m').dueDate = addMonths(addDays(t, -200), 12);
  R('ins_c').dueDate = addMonths(addDays(t, -200), 12);
  Object.assign(R('service'), { lastDate: svc.date, lastKm: svc.odo, dueKm: svc.odo + 15000, dueDate: addMonths(svc.date, 12) });
  await saveSettings({ reminders: rs, onboarded: true, car: { plate: '123-45-678', year: 2018 } }, true);
}
