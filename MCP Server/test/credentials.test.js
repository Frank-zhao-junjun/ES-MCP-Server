const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseCredentials } = require('../lib/credentials');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

function makeTempFile(content) {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `user_test_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(tmpFile, content, 'utf8');
  return tmpFile;
}

function cleanup(filePath) {
  try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
}

console.log('Credentials parser tests\n');

// --- English format ---
test('English format: User Name + Password', () => {
  const file = makeTempFile('User Name: S00222941EN\nPassword: MyPass123\n');
  try {
    const { users, passwords } = parseCredentials(file);
    assert.deepStrictEqual(users, ['S00222941EN'], `users should match, got: ${JSON.stringify(users)}`);
    assert.deepStrictEqual(passwords, ['MyPass123'], `passwords should match, got: ${JSON.stringify(passwords)}`);
  } finally { cleanup(file); }
});

test('English format: User ID + PasswordAlt', () => {
  const file = makeTempFile('User ID: ENG_USER_001\nPassword: Primary1!\nPasswordAlt: Backup2@\n');
  try {
    const { users, passwords } = parseCredentials(file);
    assert.deepStrictEqual(users, ['ENG_USER_001'], `users should match, got: ${JSON.stringify(users)}`);
    assert.deepStrictEqual(passwords, ['Primary1!', 'Backup2@'], `passwords should match, got: ${JSON.stringify(passwords)}`);
  } finally { cleanup(file); }
});

// --- Chinese format ---
test('Chinese format: 通信用户 + 密码', () => {
  const file = makeTempFile('通信用户：S00222941CN\n密码：中文密码123\n');
  try {
    const { users, passwords } = parseCredentials(file);
    assert.deepStrictEqual(users, ['S00222941CN'], `users should match, got: ${JSON.stringify(users)}`);
    assert.deepStrictEqual(passwords, ['中文密码123'], `passwords should match, got: ${JSON.stringify(passwords)}`);
  } finally { cleanup(file); }
});

test('Chinese format: 接口调用的通信用户 + 密码 + 或者这个', () => {
  const file = makeTempFile('接口调用的通信用户：CN_API_USER\n密码：第一密码\n或者这个：备用密码\n');
  try {
    const { users, passwords } = parseCredentials(file);
    assert.deepStrictEqual(users, ['CN_API_USER'], `users should match, got: ${JSON.stringify(users)}`);
    assert.deepStrictEqual(passwords, ['第一密码', '备用密码'], `passwords should match, got: ${JSON.stringify(passwords)}`);
  } finally { cleanup(file); }
});

test('Chinese format: 通信用户 with English colon', () => {
  const file = makeTempFile('通信用户: MIXED_USER\n密码: Mixed_Pass\n');
  try {
    const { users, passwords } = parseCredentials(file);
    assert.deepStrictEqual(users, ['MIXED_USER'], `users should match, got: ${JSON.stringify(users)}`);
    assert.deepStrictEqual(passwords, ['Mixed_Pass'], `passwords should match, got: ${JSON.stringify(passwords)}`);
  } finally { cleanup(file); }
});

// --- Mixed format ---
test('Mixed format: English + Chinese in same file', () => {
  const file = makeTempFile([
    'User Name: ENG_USER',
    'Password: EngPass',
    '通信用户：CN_USER',
    '密码：CnPass',
  ].join('\n'));
  try {
    const { users, passwords } = parseCredentials(file);
    assert.strictEqual(users.length, 2, `should have 2 unique users, got: ${users.length}`);
    assert.ok(users.includes('ENG_USER'), 'should include ENG_USER');
    assert.ok(users.includes('CN_USER'), 'should include CN_USER');
    assert.strictEqual(passwords.length, 2, `should have 2 unique passwords, got: ${passwords.length}`);
    assert.ok(passwords.includes('EngPass'), 'should include EngPass');
    assert.ok(passwords.includes('CnPass'), 'should include CnPass');
  } finally { cleanup(file); }
});

// --- Edge cases ---
test('Duplicate users and passwords are deduplicated', () => {
  const file = makeTempFile([
    'User Name: DUP_USER',
    'User Name: DUP_USER',
    'Password: SamePass',
    'Password: SamePass',
  ].join('\n'));
  try {
    const { users, passwords } = parseCredentials(file);
    assert.deepStrictEqual(users, ['DUP_USER'], `should deduplicate users, got: ${JSON.stringify(users)}`);
    assert.deepStrictEqual(passwords, ['SamePass'], `should deduplicate passwords, got: ${JSON.stringify(passwords)}`);
  } finally { cleanup(file); }
});

test('Empty file returns empty arrays', () => {
  const file = makeTempFile('');
  try {
    const { users, passwords } = parseCredentials(file);
    assert.deepStrictEqual(users, [], 'users should be empty');
    assert.deepStrictEqual(passwords, [], 'passwords should be empty');
  } finally { cleanup(file); }
});

test('No credentials in file returns empty arrays', () => {
  const file = makeTempFile('Some random text\nNothing useful here\n');
  try {
    const { users, passwords } = parseCredentials(file);
    assert.deepStrictEqual(users, [], 'users should be empty');
    assert.deepStrictEqual(passwords, [], 'passwords should be empty');
  } finally { cleanup(file); }
});

test('Whitespace around values is trimmed', () => {
  const file = makeTempFile('User Name:   SPACED_USER   \nPassword:    spaced_pass   \n');
  try {
    const { users, passwords } = parseCredentials(file);
    assert.deepStrictEqual(users, ['SPACED_USER'], `should trim, got: ${JSON.stringify(users)}`);
    assert.deepStrictEqual(passwords, ['spaced_pass'], `should trim, got: ${JSON.stringify(passwords)}`);
  } finally { cleanup(file); }
});

test('Multiple users and passwords (cartesian for SAP auth)', () => {
  const file = makeTempFile([
    'User Name: USER_A',
    'User Name: USER_B',
    'Password: PASS_1',
    'Password: PASS_2',
    'PasswordAlt: PASS_3',
  ].join('\n'));
  try {
    const { users, passwords } = parseCredentials(file);
    assert.strictEqual(users.length, 2, `expected 2 users, got ${users.length}`);
    assert.strictEqual(passwords.length, 3, `expected 3 passwords, got ${passwords.length}`);
    assert.ok(users.includes('USER_A') && users.includes('USER_B'), 'both users present');
    assert.ok(
      passwords.includes('PASS_1') && passwords.includes('PASS_2') && passwords.includes('PASS_3'),
      'all passwords present',
    );
  } finally { cleanup(file); }
});

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
