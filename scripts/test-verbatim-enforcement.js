import { validateRecContext } from '../lib/chat/rec-extraction.js';

let passed = 0;
let failed = 0;

function test(name, recCapture, history, currentMessage, expected) {
  // Deep clone to avoid mutation across tests
  const rc = JSON.parse(JSON.stringify(recCapture));
  validateRecContext(rc, history, currentMessage);
  const actual = rc.context;
  if (actual === expected) {
    console.log(`PASS: ${name}`);
    console.log(`  context = "${actual}"`);
    passed++;
  } else {
    console.log(`FAIL: ${name}`);
    console.log(`  expected = "${expected}"`);
    console.log(`  actual   = "${actual}"`);
    failed++;
  }
  console.log();
}

// Case A: verbatim -- should pass through unchanged
test(
  'Case A: verbatim context preserved',
  { title: 'Wonder', context: 'I like the feel and easy going tempo this song took me on' },
  [
    { role: 'user', text: 'I really like that Courtney Barnett album' },
    { role: 'assistant', text: '...' },
    { role: 'user', text: 'Wonder' },
    { role: 'assistant', text: '...' },
  ],
  "I like the feel and easy going tempo this song took me on. It's soft with and I like vocals and lyrics.",
  'I like the feel and easy going tempo this song took me on'
);

// Case B: paraphrased -- should be replaced
test(
  'Case B: paraphrased context replaced with currentMessage',
  { title: 'Wonder', context: 'You love that easy going tempo and soft feel - the vocals and lyrics really connect' },
  [
    { role: 'user', text: 'I really like that Courtney Barnett album' },
  ],
  'I like the feel and easy going tempo this song took me on',
  'I like the feel and easy going tempo this song took me on'
);

// Case C: empty context -- should fall back to currentMessage
test(
  'Case C: empty context falls back to currentMessage',
  { title: 'Wonder', context: '' },
  [],
  'save it',
  'save it'
);

// Case D: typo preserved
test(
  'Case D: typo in context preserved verbatim',
  { title: 'Wonder', context: "It's soft with and I like vocals and lyrics" },
  [],
  "I like the feel and easy going tempo this song took me on. It's soft with and I like vocals and lyrics.",
  "It's soft with and I like vocals and lyrics"
);

// Case E: case-insensitive verbatim match
test(
  'Case E: case-insensitive match preserves original casing',
  { title: 'Wonder', context: 'i like the feel and easy going tempo' },
  [],
  'I LIKE the feel and easy going tempo',
  'i like the feel and easy going tempo'
);

console.log('---');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
