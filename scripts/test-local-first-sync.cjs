const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const values = new Map();
global.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};

let nextId = 0;
let releaseFirst;
let failNext = false;
const calls = [];
const supabase = {
  from(table) {
    return {
      async insert(payload) {
        calls.push({ table, payload });
        if (calls.length === 1) await new Promise(resolve => { releaseFirst = resolve; });
        if (failNext) return { error: { message: 'temporary server error' } };
        return { error: null };
      },
    };
  },
};

const source = fs.readFileSync(path.join(__dirname, '../src/core/sync/outbox.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUnderTest = { exports: {} };
const mocks = {
  'expo-sqlite/localStorage/install': {},
  '../../supabase': { supabase },
  '../../ui/error': { generateUUID: () => `op-${++nextId}` },
  'expo-network': { getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }) },
};
new Function('require', 'module', 'exports', compiled)((name) => {
  if (!(name in mocks)) throw new Error(`Unexpected import ${name}`);
  return mocks[name];
}, moduleUnderTest, moduleUnderTest.exports);

const { bindSyncUser, flushOutbox, pendingOps, syncWrite } = moduleUnderTest.exports;
const waitFor = async condition => {
  for (let i = 0; i < 100; i++) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for synchronization');
};

(async () => {
  bindSyncUser('user-1');
  const first = await Promise.race([
    syncWrite({ table: 'items', action: 'insert', entityId: 'item-1', match: { id: 'item-1' }, payload: { id: 'item-1' } }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Local write waited for the network')), 100)),
  ]);
  assert.equal(first, 'queued');
  await waitFor(() => !!releaseFirst);
  await syncWrite({ table: 'items', action: 'insert', entityId: 'item-2', match: { id: 'item-2' }, payload: { id: 'item-2' } });
  assert.equal(pendingOps().length, 2, 'new write stays queued during an active flush');
  releaseFirst();
  await waitFor(() => pendingOps().length === 0);
  assert.deepEqual(calls.map(call => call.payload.id), ['item-1', 'item-2']);

  failNext = true;
  await syncWrite({ table: 'items', action: 'insert', entityId: 'item-3', match: { id: 'item-3' }, payload: { id: 'item-3' } });
  await waitFor(() => pendingOps()[0]?.lastError === 'temporary server error');
  assert.equal(pendingOps().length, 1, 'server errors must not discard local changes');
  failNext = false;
  await flushOutbox();
  assert.equal(pendingOps().length, 0);
  process.stdout.write('Local-first synchronization checks passed.\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
