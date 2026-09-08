'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const path = require('node:path');

const {
  DataProgram,
  Operations,
  parseAmount,
} = require('./index.js');

const applicationPath = path.join(__dirname, 'index.js');

function createOperations() {
  const dataProgram = new DataProgram();
  return { dataProgram, operations: new Operations(dataProgram) };
}

function runApplication(input) {
  return spawnSync(process.execPath, [applicationPath], {
    input,
    encoding: 'utf8',
  });
}

test('TC-001: starts with a balance of 1000.00', () => {
  const { operations } = createOperations();

  assert.equal(operations.execute('TOTAL'), 'Current balance: 1000.00');
});

test('TC-002: viewing the balance does not change it', () => {
  const { dataProgram, operations } = createOperations();

  assert.equal(operations.execute('TOTAL'), 'Current balance: 1000.00');
  assert.equal(operations.execute('TOTAL'), 'Current balance: 1000.00');
  assert.equal(dataProgram.call('READ'), 100000);
});

test('TC-003: credits and persists a positive amount', () => {
  const { operations } = createOperations();

  assert.equal(operations.execute('CREDIT', '250.00'), 'Amount credited. New balance: 1250.00');
  assert.equal(operations.execute('TOTAL'), 'Current balance: 1250.00');
});

test('TC-004: preserves two decimal places for credits', () => {
  const { operations } = createOperations();

  assert.equal(operations.execute('CREDIT', '99.99'), 'Amount credited. New balance: 1099.99');
  assert.equal(operations.execute('TOTAL'), 'Current balance: 1099.99');
});

test('TC-005: accepts a zero credit without changing the balance', () => {
  const { operations } = createOperations();

  assert.equal(operations.execute('CREDIT', '0.00'), 'Amount credited. New balance: 1000.00');
  assert.equal(operations.execute('TOTAL'), 'Current balance: 1000.00');
});

test('TC-006: debits and persists an amount within the balance', () => {
  const { operations } = createOperations();

  assert.equal(operations.execute('DEBIT', '300.00'), 'Amount debited. New balance: 700.00');
  assert.equal(operations.execute('TOTAL'), 'Current balance: 700.00');
});

test('TC-007: permits a debit equal to the current balance', () => {
  const { operations } = createOperations();

  assert.equal(operations.execute('DEBIT', '1000.00'), 'Amount debited. New balance: 0.00');
  assert.equal(operations.execute('TOTAL'), 'Current balance: 0.00');
});

test('TC-008: rejects a debit greater than the current balance', () => {
  const { operations } = createOperations();

  assert.equal(operations.execute('DEBIT', '1000.01'), 'Insufficient funds for this debit.');
  assert.equal(operations.execute('TOTAL'), 'Current balance: 1000.00');
});

test('TC-009: continues after a rejected debit', () => {
  const { operations } = createOperations();

  assert.equal(operations.execute('DEBIT', '1500.00'), 'Insufficient funds for this debit.');
  assert.equal(operations.execute('CREDIT', '100.00'), 'Amount credited. New balance: 1100.00');
  assert.equal(operations.execute('TOTAL'), 'Current balance: 1100.00');
});

test('TC-010: accepts a zero debit without changing the balance', () => {
  const { operations } = createOperations();

  assert.equal(operations.execute('DEBIT', '0.00'), 'Amount debited. New balance: 1000.00');
  assert.equal(operations.execute('TOTAL'), 'Current balance: 1000.00');
});

test('TC-011: uses a credited balance for a subsequent debit', () => {
  const { operations } = createOperations();

  operations.execute('CREDIT', '500.00');
  assert.equal(operations.execute('DEBIT', '1200.00'), 'Amount debited. New balance: 300.00');
  assert.equal(operations.execute('TOTAL'), 'Current balance: 300.00');
});

test('TC-012: uses a debited balance for a subsequent credit', () => {
  const { operations } = createOperations();

  operations.execute('DEBIT', '400.00');
  assert.equal(operations.execute('CREDIT', '50.25'), 'Amount credited. New balance: 650.25');
  assert.equal(operations.execute('TOTAL'), 'Current balance: 650.25');
});

test('TC-013: rejects an invalid menu selection without changing the balance', () => {
  const result = runApplication('5\n1\n4\n');

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Invalid choice, please select 1-4\./);
  assert.match(result.stdout, /Current balance: 1000\.00/);
});

test('TC-014: rejects menu selections outside the valid range', () => {
  const result = runApplication('0\n9\n1\n4\n');

  assert.equal(result.status, 0);
  assert.equal((result.stdout.match(/Invalid choice, please select 1-4\./g) || []).length, 2);
  assert.match(result.stdout, /Current balance: 1000\.00/);
});

test('TC-015: exits after selecting option 4', () => {
  const result = runApplication('4\n');

  assert.equal(result.status, 0);
  assert.equal((result.stdout.match(/Exiting the program\. Goodbye!/g) || []).length, 1);
});

test('TC-016: does not execute an account operation after exit', () => {
  const result = runApplication('4\n');

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /Current balance:|Amount credited|Amount debited|Insufficient funds/);
});

test('TC-017: DataProgram READ returns the stored balance', () => {
  const dataProgram = new DataProgram();

  assert.equal(dataProgram.call('READ'), 100000);
});

test('TC-018: DataProgram WRITE updates the stored balance', () => {
  const dataProgram = new DataProgram();

  dataProgram.call('WRITE', 123456);
  assert.equal(dataProgram.call('READ'), 123456);
});

test('TC-019: ignores an unknown operation code without changing data', () => {
  const { dataProgram, operations } = createOperations();

  assert.equal(operations.execute('UNKNOWN'), '');
  assert.equal(dataProgram.call('READ'), 100000);
});

test('TC-020: rejects a credit that would exceed the COBOL balance range', () => {
  const { dataProgram, operations } = createOperations();

  assert.throws(() => operations.execute('CREDIT', '999999.99'), /Balance is outside the supported range/);
  assert.equal(dataProgram.call('READ'), 100000);
});

test('TC-021: rejects a maximum-size debit as insufficient funds', () => {
  const { dataProgram, operations } = createOperations();

  assert.equal(operations.execute('DEBIT', '999999.99'), 'Insufficient funds for this debit.');
  assert.equal(dataProgram.call('READ'), 100000);
});

test('TC-022: rejects malformed and negative amounts without changing data', () => {
  const { dataProgram, operations } = createOperations();

  for (const invalidAmount of ['', 'abc', '-10.00', '10.999']) {
    assert.throws(() => operations.execute('CREDIT', invalidAmount), /Invalid amount/);
  }

  assert.equal(dataProgram.call('READ'), 100000);
  assert.throws(() => parseAmount('1000000.00'), /Invalid amount/);
});