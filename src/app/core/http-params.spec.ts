import { toParams } from './http-params';

describe('toParams', () => {
  it('skips empty values and keeps zero and false', () => {
    const p = toParams({ a: 'x', b: '', c: null, d: undefined, e: 0, f: false });
    expect(p.keys().sort()).toEqual(['a', 'e', 'f']);
    expect(p.get('e')).toBe('0');
    expect(p.get('f')).toBe('false');
  });
});
