import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { loadSession, extrasTransferables } from '../sessionLoader';

const load = (f: string) => readFileSync(`fixtures/${f}`, 'utf8');

test('квадрат: rows и extras одной длины, траектория есть', () => {
  const s = loadSession(load('square_20hz_100hz.txt'));
  if (!s.ok) throw new Error(s.error);
  expect(s.rows.length).toBe(1420);
  expect(s.extras.tip.x.length).toBe(1420);
  expect(s.extras.R.length).toBe(9 * 1420);
  expect(s.extras.displacementMode).toBe(false);
  expect(s.extras.trajectory?.stationary.length).toBe(1420);
});

test('Displacement mode: загрузка успешна, траектории нет', () => {
  const s = loadSession(load('wrist_articulation.txt'));
  if (!s.ok) throw new Error(s.error);
  expect(s.extras.displacementMode).toBe(true);
  expect(s.extras.trajectory).toBeNull();
});

test('файл без заголовка: парсеры расходятся → ошибка, а не сдвиг индексов', () => {
  const noHeader = load('square_20hz_100hz.txt').split('\n').slice(1).join('\n');
  const s = loadSession(noHeader);
  expect(s.ok).toBe(false);
});

test('пустой файл → ошибка', () => {
  expect(loadSession('').ok).toBe(false);
});

test('короткая запись: без траектории, без NaN-ловушек', () => {
  const short = load('square_20hz_100hz.txt').split('\n').slice(0, 11).join('\n');
  const s = loadSession(short);
  if (!s.ok) throw new Error(s.error);
  expect(s.rows.length).toBe(10);
  expect(s.extras.trajectory).toBeNull();
});

test('transferables: все буферы уникальны', () => {
  const s = loadSession(load('square_20hz_100hz.txt'));
  if (!s.ok) throw new Error(s.error);
  const bufs = extrasTransferables(s.extras);
  expect(new Set(bufs).size).toBe(bufs.length);
  expect(bufs.length).toBe(4 + 1 + 9 + 1); // R, tip×3, accMotionHorizG, p/base/rot×3, stationary
});
