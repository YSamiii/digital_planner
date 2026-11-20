const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
process.env.TZ = 'America/Toronto';

function makeHarness(initialChallenge) {
  const root = fs.existsSync(path.join(__dirname, '..', 'js')) ? path.join(__dirname, '..') : path.join(__dirname, '..', 'work-v0242');
  const window = { JournalModules: {}, project30InteractionTraceEditorOpen() {}, project30InteractionTraceListenerAttached() {} };
  const inputs = [];
  const notes = [];
  const nodes = new Map();
  const state = { schemaVersion: 12, challenges: [initialChallenge] };
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', textContent: '', innerHTML: '', hidden: false, dataset: {}, classList: { toggle() {} }, addEventListener() {} });
    return nodes.get(selector);
  };
  const document = {
    querySelectorAll(selector) {
      if (selector.includes('data-rule-note')) return notes;
      if (selector.includes('data-challenge-rule-id') || selector.includes('#challengeDayRules input[type=checkbox]')) return inputs;
      return [];
    }
  };
  const localStorage = { getItem: key => key === 'journal-planner-v091' ? JSON.stringify(state) : null };
  const context = {
    window, document, localStorage, console, Date, Set, Map, Math, Number, String, Object, Array, JSON,
    alert() {}, confirm() { return true; },
    createProductivityModule: undefined
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'challenge-schedule.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'productivity.js'), 'utf8'), context);
  const modal = { open() {}, close() {}, push() {}, pop() {} };
  const module = context.window.JournalModules.createProductivityModule({
    qs: node, qsa: () => [], esc: value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]),
    iso: date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    getState: () => state, save: () => ({ ok: true }), modal,
    commitChallengeCandidate(candidate) { state.challenges = candidate.challenges; state.schemaVersion = candidate.schemaVersion; return { ok: true, persisted: true }; },
    commitTwelveWeekCandidate() { return { ok: true }; }
  });
  function open(date) {
    inputs.splice(0, inputs.length, ...initialChallenge.checklistRules.map(rule => ({
      value: rule.id, checked: state.challenges[0].dailyLogs?.[date]?.[rule.id] === true,
      dataset: { challengeRuleId: rule.id }
    })));
    module.openChallengeDay(initialChallenge.id, date);
  }
  return { module, state, inputs, node, open };
}

const rules = [
  { id: 'read', title: '阅读', required: true, sortOrder: 0 },
  { id: 'walk', title: '运动', required: true, sortOrder: 1 },
  { id: 'sleep', title: '早睡', required: true, sortOrder: 2 }
];

test('challenge day editor saves partial, completed, then unchecked items without duplicate days', () => {
  const date = '2026-11-20';
  const challenge = { id: 'multi', title: '每日三项', mode: 'checklist', checklistTaskMode: 'multi', checklistRules: rules, rules: rules.map(x => x.title), startDate: date, endDate: '2026-12-19', days: 30, frequencyHistory: [{ effectiveFrom: date, mode: 'daily' }], dailyLogs: {}, completedDates: [], status: 'active' };
  const h = makeHarness(challenge);
  h.open(date);
  assert.match(h.node('#challengeDayRules').innerHTML, /data-challenge-rule-id="read"/);
  h.inputs[0].checked = true;
  h.module.recordChallengeCheckboxChange(h.inputs[0]);
  assert.equal(h.module.saveChallengeDay().ok, true);
  assert.deepEqual(h.state.challenges[0].completedDates, []);
  assert.equal(h.state.challenges[0].dailyLogs[date].read, true);
  assert.equal(h.state.challenges[0].dailyLogs[date].checklistRuleSnapshots.length, 3);

  h.open(date);
  h.inputs.forEach(input => { input.checked = true; h.module.recordChallengeCheckboxChange(input); });
  h.module.saveChallengeDay();
  assert.deepEqual(h.state.challenges[0].completedDates, [date]);
  assert.equal(h.module.__challengeTest.challengeStats(h.state.challenges[0], date).includes('1/30'), true);

  h.open(date);
  h.inputs[1].checked = false;
  h.module.recordChallengeCheckboxChange(h.inputs[1]);
  h.module.saveChallengeDay();
  assert.deepEqual(h.state.challenges[0].completedDates, []);
  assert.equal(h.state.challenges[0].dailyLogs[date].walk, undefined);
  assert.equal(h.state.challenges[0].dailyLogs[date].read, true);
});

test('saving a note on an old one-click completion does not erase history or invent task results', () => {
  const date = '2026-11-19';
  const challenge = { id: 'legacy', title: '旧挑战', mode: 'checklist', checklistTaskMode: 'multi', checklistRules: rules, rules: rules.map(x => x.title), startDate: '2026-11-01', endDate: '2026-11-30', days: 30, frequencyHistory: [{ effectiveFrom: '2026-11-01', mode: 'daily' }], dailyLogs: { [date]: { dailyNote: '历史备注' } }, completedDates: [date], status: 'active' };
  const h = makeHarness(challenge);
  h.open(date);
  h.node('#challengeDayNote').value = '仅更新备注';
  h.module.saveChallengeDay();
  assert.deepEqual(h.state.challenges[0].completedDates, [date]);
  assert.equal(h.state.challenges[0].dailyLogs[date].dailyNote, '仅更新备注');
  assert.equal(h.state.challenges[0].dailyLogs[date].checklistRuleSnapshots, undefined);
  assert.equal(h.state.challenges[0].dailyLogs[date].read, undefined);
});
