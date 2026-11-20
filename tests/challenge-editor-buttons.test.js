const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Challenge task editor exposes all inline button callbacks', () => {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'js/productivity.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const window = { JournalModules: { challengeSchedule: {} } };
  const localStorage = { getItem() { return null; } };
  const context = { window, localStorage, document: {}, console, Date, Math, JSON };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'js/productivity.js' });

  const rows = [];
  const multiMode = { checked: false };
  const host = {
    children: rows,
    insertAdjacentHTML(_position, markup) {
      const input = { disabled: false, setAttribute() {}, focus() {} };
      const row = {
        markup, parentNode: host,
        querySelector() { return input; },
        remove() { rows.splice(rows.indexOf(row), 1); }
      };
      Object.defineProperties(row, {
        previousElementSibling: { get() { return rows[rows.indexOf(row) - 1] || null; } },
        nextElementSibling: { get() { return rows[rows.indexOf(row) + 1] || null; } }
      });
      rows.push(row);
    },
    insertBefore(row, reference) {
      rows.splice(rows.indexOf(row), 1);
      rows.splice(rows.indexOf(reference), 0, row);
    },
    get lastElementChild() { return rows[rows.length - 1] || null; }
  };
  const module = window.JournalModules.createProductivityModule({
    qs: selector => selector === '#challengeChecklistRules' ? host : selector === '#challengeMultiTaskMode' ? multiMode : {},
    esc: value => String(value ?? ''),
    getState: () => ({ challenges: [] }),
    iso: () => '2026-11-20',
    modal: { open() {}, close() {} }
  });
  assert.match(app, /Object\.assign\(window,productivityModule/);
  Object.assign(window, module); // This is how js/app.js registers global callbacks.

  for (const name of ['addChallengeChecklistRule', 'moveChallengeChecklistRule', 'removeChallengeChecklistRule']) {
    assert.equal(typeof window[name], 'function', name + ' must be visible to inline onclick');
  }
  assert.match(html, /onclick="addChallengeChecklistRule\(\)"/);
  assert.match(source, /onclick="moveChallengeChecklistRule\(this,-1\)"/);
  assert.match(source, /onclick="removeChallengeChecklistRule\(this\)"/);

  window.addChallengeChecklistRule();
  assert.equal(rows.length, 1, 'add task should insert a row');
  const first = rows[0];
  window.addChallengeChecklistRule();
  assert.equal(rows.length, 2, 'second task should insert another row');
  assert.equal(multiMode.checked, true, 'second task enables multi-item mode for new challenges');

  window.moveChallengeChecklistRule({ closest: () => rows[1] }, -1);
  assert.notEqual(rows[0], first, 'move up changes row order');
  window.moveChallengeChecklistRule({ closest: () => rows[0] }, 1);
  assert.equal(rows[0], first, 'move down changes row order');
  window.removeChallengeChecklistRule({ closest: () => rows[0] });
  assert.equal(rows.length, 1, 'remove task deletes the selected row');
});
