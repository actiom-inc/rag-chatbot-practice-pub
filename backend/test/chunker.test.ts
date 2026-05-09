import * as assert from 'node:assert/strict';
import { chunkPages, ExtractedPage } from '../src/pdf/chunker';

const pages: ExtractedPage[] = [
  {
    pageNumber: 1,
    text: `${'A'.repeat(900)}。\n\n${'B'.repeat(900)}。`,
  },
  {
    pageNumber: 2,
    text: `${'C'.repeat(900)}。\n\n${'D'.repeat(900)}。`,
  },
];

const chunks = chunkPages(pages, {
  targetChars: 1200,
  overlapChars: 150,
});

assert.ok(chunks.length >= 2);
assert.equal(chunks[0].chunkIndex, 0);
assert.equal(chunks[0].pageStart, 1);
assert.ok(chunks.some((chunk) => chunk.pageEnd === 2));
assert.ok(chunks.every((chunk) => chunk.content.length > 0));

console.log('chunker tests passed');
