const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
process.env.TZ = 'America/Toronto';

function loadModules() {
  const window = { JournalModules: {} };
  const context = { window, console, Date, Set, Map, Math, Number, String, Object, Array };
  vm.createContext(context);
  const root = fs.existsSync(path.join(__dirname, '..', 'js')) ? path.join(__dirname, '..') : path.join(__dirname, '..', 'work-v0242');
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'challenge-schedule.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'today-focus.js'), 'utf8'), context);
  return { schedule: window.JournalModules.challengeSchedule, focus: window.TodayFocus };
}

const rule = (id, title, sortOrder) => ({ id, title, required: true, sortOrder });

test('partial multi-task completion is saved by stable IDs and only full completion counts', () => {
  const { schedule } = loadModules();
  const challenge = {
    mode: 'checklist', checklistTaskMode: 'multi',
    checklistRules: [rule('read', 'Read', 0), rule('walk', 'Walk', 1), rule('sleep', 'Sleep early', 2)],
    dailyLogs: { '2026-01-05': { read: true, checklistRuleSnapshots: [rule('read', 'Read', 0), rule('walk', 'Walk', 1), rule('sleep', 'Sleep early', 2)] } },
    completedDates: []
  };
  assert.deepEqual(JSON.parse(JSON.stringify(schedule.checklistProgress(challenge, '2026-01-05'))).done, 1);
  assert.equal(schedule.hasCheckin(challenge, '2026-01-05'), false);
  challenge.dailyLogs['2026-01-05'].walk = true;
  challenge.dailyLogs['2026-01-05'].sleep = true;
  assert.equal(schedule.hasCheckin(challenge, '2026-01-05'), true);
  delete challenge.dailyLogs['2026-01-05'].walk;
  assert.equal(schedule.hasCheckin(challenge, '2026-01-05'), false);
});

test('date snapshots preserve old rule names and order after edits', () => {
  const { schedule } = loadModules();
  const challenge = {
    checklistTaskMode: 'multi', checklistRules: [rule('new', 'Renamed task', 0), rule('added', 'New task', 1)],
    dailyLogs: { '2026-01-05': { old: true, checklistRuleSnapshots: [rule('old', 'Original task', 0), rule('keep', 'Second task', 1)] } }
  };
  const progress = JSON.parse(JSON.stringify(schedule.checklistProgress(challenge, '2026-01-05')));
  assert.deepEqual(progress.rules.map(x => [x.id, x.title]), [['old', 'Original task'], ['keep', 'Second task']]);
  assert.equal(progress.done, 1);
});

test('legacy rules and completedDates remain one-click without fabricated subtasks', () => {
  const { schedule } = loadModules();
  const challenge = { rules: ['Read', 'Walk'], completedDates: ['2026-01-05'], dailyLogs: { '2026-01-05': { dailyNote: 'old note' } } };
  assert.equal(schedule.isMultiTask(challenge), false);
  assert.equal(schedule.hasCheckin(challenge, '2026-01-05'), true);
  assert.deepEqual(JSON.parse(JSON.stringify(schedule.checklistRules(challenge))).map(x => x.id), ['legacy-0', 'legacy-1']);
  challenge.checklistTaskMode = 'multi';
  const progress = JSON.parse(JSON.stringify(schedule.checklistProgress(challenge, '2026-01-05')));
  assert.equal(progress.done, 0);
  assert.equal(progress.legacyCheckin, true);
  assert.equal(schedule.hasCheckin(challenge, '2026-01-05'), true);
});

test('score logs and note-only days retain v0.24.1 check-in semantics', () => {
  const { schedule } = loadModules();
  const challenge = { mode: 'score', dailyLogs: { '2026-01-05': { requiredA: true, dailyNote: 'note' }, '2026-01-06': { dailyNote: 'note only' } } };
  assert.equal(schedule.hasCheckin(challenge, '2026-01-05'), true);
  assert.equal(schedule.hasCheckin(challenge, '2026-01-06'), false);
});

test('weekly target counts unique eligible days and not duplicate or rest-day records', () => {
  const { schedule } = loadModules();
  const challenge = {
    startDate: '2026-01-05', days: 14, mode: 'checklist',
    frequencyHistory: [{ effectiveFrom: '2026-01-05', mode: 'weekly_count', weeklyTarget: 2 }],
    completedDates: ['2026-01-05', '2026-01-05', '2026-01-06', '2026-01-07']
  };
  const week = JSON.parse(JSON.stringify(schedule.week(challenge, '2026-01-08')));
  assert.deepEqual(week.eligible, ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11']);
  assert.equal(week.done, 3);
  assert.equal(week.reached, true);
});

test('fixed weekdays, cross-week editing, local dates, and weekly streak remain independent', () => {
  const { schedule } = loadModules();
  const challenge = {
    startDate: '2026-03-02', days: 21, mode: 'checklist', completedDates: ['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-09', '2026-03-11', '2026-03-13'],
    frequencyHistory: [{ effectiveFrom: '2026-03-02', mode: 'weekdays', weekdays: [1, 3, 5] }]
  };
  assert.deepEqual(JSON.parse(JSON.stringify(schedule.week(challenge, '2026-03-10'))).eligible, ['2026-03-09', '2026-03-11', '2026-03-13']);
  assert.equal(schedule.hasCheckin(challenge, '2026-03-09'), true);
  assert.equal(schedule.hasCheckin(challenge, '2026-03-10'), false);
  assert.equal(schedule.weeklyStreak(challenge, '2026-03-16'), 2);
  assert.equal(schedule.monday('2026-03-09'), '2026-03-09');
  assert.equal(schedule.add('2026-03-08', 1), '2026-03-09');
});

test('Today Focus keeps incomplete multi-task challenges visible with x/y progress', () => {
  const { focus } = loadModules();
  const challenge = {
    id: 'c1', mode: 'checklist', checklistTaskMode: 'multi', startDate: '2026-01-05', days: 30,
    checklistRules: [rule('read', 'Read', 0), rule('walk', 'Walk', 1)],
    dailyLogs: { '2026-01-05': { read: true, checklistRuleSnapshots: [rule('read', 'Read', 0), rule('walk', 'Walk', 1)] } }, completedDates: []
  };
  const rows = focus.collectChallengeFocusItems({}, '2026-01-05', { getActiveChallengeDashboardCards: () => [{ challengeId: 'c1', kind: 'focus', record: challenge, duration: 30, currentDay: 1 }] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'challenge_focus_incomplete');
  assert.match(rows[0].subtitle, /1\/2/);
  challenge.dailyLogs['2026-01-05'].walk = true;
  assert.equal(focus.collectChallengeFocusItems({}, '2026-01-05', { getActiveChallengeDashboardCards: () => [{ challengeId: 'c1', kind: 'focus', record: challenge, duration: 30, currentDay: 1 }] }).length, 0);
});
