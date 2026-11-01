import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseTSV } from '../tsvParser';
import { parseTsv, DT } from '../imuProcessing';

const FILES = ['square_20hz_100hz.txt', 'wrist_articulation_v2.txt', 'wrist_articulation.txt'];

test.each(FILES)('parseTSV: время i·DT и число строк как у эталона (%s)', f => {
  const text = readFileSync(`fixtures/${f}`, 'utf8');
  const rows = parseTSV(text);
  const rec = parseTsv(text);
  expect(rows.length).toBe(rec.n);
  rows.forEach((r, i) => expect(r.time).toBe(i * DT));
  expect(rows.map(r => r.angleX)).toEqual(Array.from(rec.ang[0]));
});
