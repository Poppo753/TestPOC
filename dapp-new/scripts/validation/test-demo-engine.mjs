/**
 * Dependency-free behavioral test for the deterministic demo engine.
 *
 * It deliberately uses no browser storage or DOM. A failure here means the
 * simulated accounting journey is internally inconsistent and the UI should
 * not be reviewed until it is fixed.
 */
import assert from 'node:assert/strict';
import { createInitialState } from '../../assets/js/demo/storage.js';
import { advanceDays, deposit, positionValue, summarize, withdraw } from '../../assets/js/demo/engine.js';
import { vaultById } from '../../assets/js/demo/data.js';

const state = createInitialState();
assert.equal(summarize(state).total, 10000);

deposit(state, 'reserve', 2500, new Date('2026-07-23T10:00:00Z'));
assert.equal(state.walletBalance, 7500);
assert.equal(state.positions.reserve.principal, 2500);
assert.equal(state.activity[0].type, 'Deposit');

advanceDays(state, 30, new Date('2026-08-22T10:00:00Z'));
const grown = positionValue(state.positions.reserve, vaultById('reserve'));
assert.ok(grown > 2500, 'Illustrative value should grow after advancing time.');
assert.equal(state.simulatedDays, 30);

withdraw(state, 'reserve', 1000, new Date('2026-08-22T10:01:00Z'));
assert.equal(state.walletBalance, 8500);
assert.ok(positionValue(state.positions.reserve, vaultById('reserve')) > 1500);

const remainder = positionValue(state.positions.reserve, vaultById('reserve'));
withdraw(state, 'reserve', remainder, new Date('2026-08-22T10:02:00Z'));
assert.equal(state.positions.reserve, undefined);
assert.equal(summarize(state).positionCount, 0);

assert.throws(() => deposit(state, 'reserve', 999999), /enough USDC/);
assert.throws(() => deposit(state, 'missing', 1), /does not exist/);
assert.throws(() => advanceDays(state, 30), /Deposit/);

console.log('Demo engine test passed: deposit, deterministic growth, partial/full withdrawal and error boundaries.');

