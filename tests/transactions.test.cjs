const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function moduleFrom(path, imports = {}) {
  const output = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: name => { if (!(name in imports)) throw new Error(name); return imports[name]; }, Response });
  return exports;
}
function fixture() {
  const rows = new Map([
    [1, { id: 1, type: 'expense', amountCents: 15050, description: 'Gasto de teste' }],
    [2, { id: 2, type: 'income', amountCents: 100000, description: 'Receita de teste' }],
  ]);
  const db = {
    update: () => ({ set: values => ({ where: id => ({ returning: async () => {
      if (!rows.has(id)) return [];
      rows.set(id, { ...rows.get(id), ...values });
      return [rows.get(id)];
    } }) }) }),
    delete: () => ({ where: id => ({ returning: async () => {
      if (!rows.has(id)) return [];
      rows.delete(id); return [{ id }];
    } }) }),
  };
  const route = moduleFrom('app/api/transactions/[id]/route.ts', {
    'drizzle-orm': { eq: (_column, id) => id },
    '../../../../db': { getDb: () => db },
    '../../../../db/schema': { transactions: { id: 'id' } },
  });
  return { rows, route };
}
const context = id => ({ params: Promise.resolve({ id: String(id) }) });
for (const [id, type] of [[1, 'expense'], [2, 'income']]) {
  test(`editar e excluir ${type}, preservando o outro registro`, async () => {
    const { rows, route } = fixture();
    const payload = { description: 'Corrigido', amountCents: 12345, type, category: type === 'income' ? 'Salário' : 'Alimentação', transactionDate: '2026-10-15', paymentMethod: 'Pix', notes: '' };
    const updated = await route.PUT(new Request('https://example.com', { method: 'PUT', body: JSON.stringify(payload) }), context(id));
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).transaction.amountCents, 12345);
    assert.equal(rows.get(id).type, type);
    const deleted = await route.DELETE(new Request('https://example.com'), context(id));
    assert.equal(deleted.status, 200);
    assert.equal(rows.has(id), false);
    assert.equal(rows.size, 1);
    assert.equal((await route.DELETE(new Request('https://example.com'), context(id))).status, 404);
  });
}
test('edição inexistente não informa sucesso', async () => {
  const { route } = fixture();
  const result = await route.PUT(new Request('https://example.com', { method: 'PUT', body: JSON.stringify({ description:'Teste', amountCents: 100, type:'income', category:'Salário', transactionDate:'2026-10-15' }) }), context(99));
  assert.equal(result.status, 404);
});
test('IDs inválidos não removem dados', async () => {
  const { route, rows } = fixture();
  for (const id of ['abc', '-1', '0', '1.2']) assert.equal((await route.DELETE(new Request('https://example.com'), context(id))).status, 400);
  assert.equal(rows.size, 2);
});
test('valores em edição mantêm centavos com vírgula ou ponto', () => {
  const { parseAmountCents } = moduleFrom('lib/money.ts');
  for (const [input, expected] of [['150,50',15050],['150.50',15050],['1.500,50',150050],['1.500',150000],['0,01',1],['10',1000]]) assert.equal(parseAmountCents(input), expected);
  for (const input of ['', 'abc', '-1', '0', '1,234', '1.2.3']) assert.equal(parseAmountCents(input), null);
});
