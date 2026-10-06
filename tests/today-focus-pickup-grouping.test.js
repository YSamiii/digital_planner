const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const root = require('path').resolve(__dirname, '..');
const document = { documentElement: { lang: 'zh-CN' } };
const context = { window: {}, document, JSON, Date, Set, Map, String, Number, Array, Object, Math };
vm.createContext(context);
vm.runInContext(fs.readFileSync(require.resolve('../js/today-focus-i18n.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(require.resolve('../js/today-focus.js'), 'utf8'), context);

const focus = context.window.TodayFocus;
const today = '2026-10-06';
const state = orders => ({ schemaVersion: 12, orders: { sellers: [], forwardingBatches: [], items: orders } });
const order = (id, sellerNameSnapshot, status, extra = {}) => ({ id, sellerNameSnapshot, status, fulfillmentType: 'pickup', ...extra });
const pickupItems = source => focus.collectOrderFocusItems(source, today, {}).filter(row => row.type === 'pickup_orders');

// 0 / 1 / 2 / 3+ pickup records always create zero or one derived focus item.
assert.strictEqual(pickupItems(state([])).length, 0);
let rows = pickupItems(state([order('a', 'Grace', 'ready_for_pickup')]));
assert.strictEqual(rows.length, 1);
assert.deepStrictEqual(Array.from(rows[0].meta.orderIds), ['a']);
assert.strictEqual(focus.subtitleText(rows[0]), 'Grace');
rows = pickupItems(state([order('b', '蟹老板', 'at_pickup_point'), order('a', 'Grace', 'ready_for_pickup')]));
assert.strictEqual(rows.length, 1);
assert.deepStrictEqual(Array.from(rows[0].meta.orderIds), ['a', 'b']);
assert.strictEqual(focus.subtitleText(rows[0]), '2 个可以取货 · Grace · 蟹老板');
rows = pickupItems(state([order('c', '第三家', 'ready_for_pickup'), order('b', '蟹老板', 'at_pickup_point'), order('a', 'Grace', 'ready_for_pickup')]));
assert.strictEqual(rows.length, 1);
assert.strictEqual(focus.subtitleText(rows[0]), '3 个可以取货 · Grace · 蟹老板 · +1');

// Expected date, then canonical ID, makes the seller presentation stable across reloads.
rows = pickupItems(state([order('z', 'Late', 'ready_for_pickup', { expectedDate: '2026-10-08' }), order('b', 'First', 'ready_for_pickup', { expectedDate: '2026-10-07' }), order('a', 'First-ID', 'ready_for_pickup', { expectedDate: '2026-10-07' })]));
assert.deepStrictEqual(Array.from(rows[0].meta.orderIds), ['a', 'b', 'z']);
assert.deepStrictEqual(Array.from(pickupItems(JSON.parse(JSON.stringify(state([order('z', 'Late', 'ready_for_pickup', { expectedDate: '2026-10-08' }), order('b', 'First', 'ready_for_pickup', { expectedDate: '2026-10-07' }), order('a', 'First-ID', 'ready_for_pickup', { expectedDate: '2026-10-07' })]))))[0].meta.orderIds), ['a', 'b', 'z']);

// Terminal, archived, and deleted records never enter either the focus group or its IDs.
rows = pickupItems(state([
  order('show', 'Visible', 'ready_for_pickup'),
  order('archived', 'Archived', 'ready_for_pickup', { archived: true }),
  order('done', 'Done', 'picked_up'),
  order('cancelled', 'Cancelled', 'cancelled'),
  order('returned', 'Returned', 'returned'),
  order('deleted', 'Deleted', 'ready_for_pickup', { deleted: true })
]));
assert.deepStrictEqual(Array.from(rows[0].meta.orderIds), ['show']);

// Forwarding uses the supplied effective-status helper rather than its raw order status.
const forwarding = state([order('forward', 'Forwarder', 'ordered', { fulfillmentType: 'forwarding', forwarding: { batchId: 'batch-1' } })]);
forwarding.orders.forwardingBatches = [{ id: 'batch-1', currentStage: 'at_pickup_point' }];
rows = focus.collectOrderFocusItems(forwarding, today, { getEffectiveOrderStatus: row => row.fulfillmentType === 'forwarding' ? 'at_pickup_point' : row.status }).filter(row => row.type === 'pickup_orders');
assert.deepStrictEqual(Array.from(rows[0].meta.orderIds), ['forward']);

// Grouping takes one slot and preserves the overall five-item Today Focus cap.
const mixed = state([order('a', 'Grace', 'ready_for_pickup'), order('b', '蟹老板', 'ready_for_pickup'), order('c', 'Third', 'ready_for_pickup')]);
mixed.subscriptions = [{ id: 'sub-a', status: 'active', name: 'Subscription', nextRenewal: today }];
mixed.challenges = [];
const built = focus.buildTodayFocusItems(mixed, today, {});
assert.strictEqual(built.filter(row => row.type === 'pickup_orders').length, 1);
assert.strictEqual(focus.render(mixed, today, {}).match(/today-focus-row/g).length, Math.min(5, built.length));
assert(focus.render(mixed, today, {}).includes("'pickup_orders'"));

// English is rendered through the Today Focus dictionary, not hardcoded UI text.
document.documentElement.lang = 'en';
rows = pickupItems(state([order('a', 'Grace', 'ready_for_pickup'), order('b', 'Crab Boss', 'ready_for_pickup'), order('c', 'Third', 'ready_for_pickup')]));
assert.strictEqual(context.window.TodayFocusI18n.t('pickupOrders'), 'Pickup Orders');
assert.strictEqual(focus.subtitleText(rows[0]), '3 orders ready for pickup · Grace · Crab Boss · +1');
document.documentElement.lang = 'zh-CN';

// The real click path must use the collection deep-link, never a representative order ID.
const dashboard = fs.readFileSync(require.resolve('../js/v0200-dashboard-forwarding-backup.js'), 'utf8');
assert(dashboard.includes("if(type==='pickup_orders')return window.openPickupOrdersFromToday?.();"));
assert(dashboard.includes('window.TodayFocus?.collectPickupOrdersForTodayFocus?.'));
assert(!dashboard.includes("if(type==='pickup_orders')return window.openOrderEditor?.(id)"));

const i18n = fs.readFileSync(require.resolve('../js/today-focus-i18n.js'), 'utf8');
assert(i18n.includes("pickupOrders: { zh: '待取订单', en: 'Pickup Orders' }"));
assert(i18n.includes("pickupReadyCount: { zh: '{count} 个可以取货', en: '{count} orders ready for pickup' }"));
console.log('Today Focus pickup grouping: 26 assertions passed.');
