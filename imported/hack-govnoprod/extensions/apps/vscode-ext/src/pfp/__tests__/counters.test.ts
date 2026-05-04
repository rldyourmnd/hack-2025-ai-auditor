import { bucketize, bucketizeLines, bucketizeCyclomatic } from '../counters';

describe('counters bucketization', () => {
  test('bucketize small values', () => {
    expect(bucketize(0)).toBe(0);
    expect(bucketize(1)).toBe(1);
    expect(bucketize(2)).toBe(2);
    expect(bucketize(5)).toBe(3);
    expect(bucketize(10)).toBe(4);
    expect(bucketize(20)).toBe(5);
    expect(bucketize(100)).toBe(6);
  });

  test('lines bucketization', () => {
    expect(bucketizeLines(0)).toBe(0);
    expect(bucketizeLines(50)).toBe(1);
    expect(bucketizeLines(150)).toBe(2);
    expect(bucketizeLines(300)).toBe(3);
    expect(bucketizeLines(700)).toBe(4);
    expect(bucketizeLines(1200)).toBe(5);
    expect(bucketizeLines(5000)).toBe(6);
  });

  test('cyclomatic bucketization', () => {
    expect(bucketizeCyclomatic(0)).toBe(0);
    expect(bucketizeCyclomatic(1)).toBe(1);
    expect(bucketizeCyclomatic(2)).toBe(2);
    expect(bucketizeCyclomatic(5)).toBe(3);
    expect(bucketizeCyclomatic(7)).toBe(4);
    expect(bucketizeCyclomatic(10)).toBe(5);
    expect(bucketizeCyclomatic(20)).toBe(6);
  });
});


