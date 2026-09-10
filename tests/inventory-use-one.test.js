const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../js/inventory.js'),'utf8');
const context={window:{JournalModules:{}},setTimeout,clearTimeout};vm.runInNewContext(source,context);
const logic=context.window.JournalModules.createInventoryUseOneLogic();
const state=()=>({schemaVersion:12,inventory:{items:[
  {id:'same-name-a',name:'Coffee',quantity:5,location:'Pantry',unit:'bag',history:[]},
  {id:'same-name-b',name:'Coffee',quantity:9,location:'Kitchen',unit:'bag',history:[]},
  {id:'last-one',name:'Tea',quantity:1,location:'Pantry',unit:'box',history:[]},
  {id:'empty',name:'Salt',quantity:0,location:'Pantry',unit:'pack',history:[]}
]}});
function commit(slot,candidate,itemId,expectedQuantity,shouldSucceed=true){
  if(!shouldSucceed)return {ok:false,message:'simulated quota failure'};
  const persisted=JSON.parse(JSON.stringify(candidate)),item=persisted.inventory.items.find(x=>x.id===itemId);
  assert(item);assert.strictEqual(item.quantity,expectedQuantity);assert.strictEqual(persisted.schemaVersion,12);assert(item.quantity>=0);
  slot.value=persisted;return {ok:true};
}
let slot={value:state()},staged=logic.stageUseOne(slot.value,'same-name-a',1000);
assert(staged.ok);assert.strictEqual(staged.previousQuantity,5);assert.strictEqual(staged.nextQuantity,4);assert.strictEqual(slot.value.inventory.items[0].quantity,5);
assert(commit(slot,staged.candidate,staged.itemId,staged.nextQuantity).ok);assert.strictEqual(slot.value.inventory.items.find(x=>x.id==='same-name-a').quantity,4);assert.strictEqual(slot.value.inventory.items.find(x=>x.id==='same-name-b').quantity,9);
assert.strictEqual(JSON.parse(JSON.stringify(slot.value)).inventory.items.find(x=>x.id==='same-name-a').quantity,4);
staged=logic.stageUseOne(slot.value,'last-one',2000);assert(staged.ok);assert.strictEqual(staged.nextQuantity,0);commit(slot,staged.candidate,staged.itemId,0);assert.strictEqual(slot.value.inventory.items.find(x=>x.id==='last-one').quantity,0);
assert.deepStrictEqual(logic.stageUseOne(slot.value,'empty',3000).reason,'empty');
assert(slot.value.inventory.items.every(item=>item.quantity>=0));
const beforeFailure=JSON.stringify(slot.value),failed=logic.stageUseOne(slot.value,'same-name-a',4000);assert(failed.ok);assert(!commit(slot,failed.candidate,failed.itemId,failed.nextQuantity,false).ok);assert.strictEqual(JSON.stringify(slot.value),beforeFailure);
const undo=logic.stageUndo(slot.value,{itemId:'same-name-a',previousQuantity:5,nextQuantity:4},5000);assert(undo.ok);assert.strictEqual(undo.nextQuantity,5);commit(slot,undo.candidate,undo.itemId,5);assert.strictEqual(slot.value.inventory.items.find(x=>x.id==='same-name-a').quantity,5);
const useAgain=logic.stageUseOne(slot.value,'same-name-a',6000);commit(slot,useAgain.candidate,useAgain.itemId,4);const undoFailure=logic.stageUndo(slot.value,{itemId:'same-name-a',previousQuantity:5,nextQuantity:4},7000);assert(undoFailure.ok);assert(!commit(slot,undoFailure.candidate,undoFailure.itemId,5,false).ok);assert.strictEqual(slot.value.inventory.items.find(x=>x.id==='same-name-a').quantity,4);
assert.strictEqual(logic.stageUndo(slot.value,{itemId:'same-name-a',previousQuantity:5,nextQuantity:3},8000).reason,'stale_undo');
const inventorySource=fs.readFileSync(require.resolve('../js/inventory.js'),'utf8');
assert(inventorySource.includes("list.sort(sortItems(sort))"));assert(inventorySource.includes("list=list.filter(i=>i.category===category)"));assert(inventorySource.includes("list=list.filter(i=>i.location===location)"));assert(inventorySource.includes('inventoryUseOne'));
const app=fs.readFileSync(require.resolve('../js/app.js'),'utf8');assert(app.includes('PersistenceFoundation?.commitCanonical'));assert(app.includes('function commitInventoryCandidate'));assert(app.includes('Number(persisted.schemaVersion)!==12'));
console.log('Inventory Use One: 30 assertions passed.');
