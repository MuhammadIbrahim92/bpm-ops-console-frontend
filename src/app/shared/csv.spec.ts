import { downloadCsv } from './csv';

describe('downloadCsv', () => {
  let captured: Blob | null = null;

  beforeEach(() => {
    captured = null;
    spyOn(URL, 'createObjectURL').and.callFake((b: Blob | MediaSource) => {
      captured = b as Blob;
      return 'blob:test';
    });
    spyOn(URL, 'revokeObjectURL').and.stub();
    spyOn(HTMLAnchorElement.prototype, 'click').and.stub();
  });

  it('writes a header and quotes values', async () => {
    downloadCsv('rows', [{ field: 'a', header: 'A' }, { field: 'b', header: 'B' }],
      [{ a: 'x,y', b: 'say "hi"' }, { a: null, b: 3 }]);
    const text = await captured!.text();
    expect(text.replace('﻿', '')).toBe('"A","B"\r\n"x,y","say ""hi"""\r\n,"3"');
  });

  it('adds the .csv extension to the file name', () => {
    let name = '';
    (HTMLAnchorElement.prototype.click as jasmine.Spy).and.callFake(function (this: HTMLAnchorElement) {
      name = this.download;
    });
    downloadCsv('instances', [{ field: 'a', header: 'A' }], []);
    expect(name).toBe('instances.csv');
  });
});
