(function(){
  'use strict';
  // Batch edits are staged on a deep copy. UI never mutates the live state before
  // a single verified canonical commit succeeds.
  const FIELD_DEFS={
    inventory:[['category','分类'],['location','位置'],['status','归档 / 恢复'],['quantityDelta','库存数量增减'],['expiryDate','有效期'],['tagsAdd','添加标签'],['tagsRemove','移除标签'],['lowStockEnabled','低库存提醒']],
    subscriptions:[['status','订阅状态'],['payment','付款方式'],['currency','币种'],['autoRenew','自动续费']],
    wishlist:[['notesAppend','追加清单说明']],
    wishItem:[['status','购买状态'],['store','商店 / 网站'],['price','价格'],['notesAppend','追加备注']]
  };
  const LABELS={inventory:'库存物品',subscriptions:'订阅',wishlist:'Wish List 清单',wishItem:'Wish List 物品'};
  const CHOICES={
    'inventory:status':[['active','恢复为在用'],['archived','归档']],
    'inventory:lowStockEnabled':[['true','开启'],['false','关闭']],
    'subscriptions:status':[['active','进行中'],['paused','暂停'],['cancelled','取消']],
    'subscriptions:autoRenew':[['true','开启'],['false','关闭']],
    'wishItem:status':[['watching','观望'],['waiting','等降价'],['ready','准备买'],['purchased','已购买'],['dropped','放弃']]
  };
  const text=x=>String(x??'');
  const fail=message=>({ok:false,message});
  function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().startsWith(value);}
  function getRows(state,kind,scope=''){
    if(kind==='inventory')return state?.inventory?.items;
    if(kind==='subscriptions')return state?.subscriptions;
    if(kind==='wishlist')return state?.wishlists;
    if(kind==='wishItem')return state?.wishlists?.find(x=>text(x?.id)===text(scope))?.items;
    return null;
  }
  function buildAppBulkCandidate(current,{kind,scope='',ids,field,value,now=Date.now()}={}){
    const fields=FIELD_DEFS[kind];
    if(!fields||!fields.some(([key])=>key===field))return fail('此模块不支持该批量字段。');
    const unique=[...new Set((ids||[]).map(text))];
    if(!unique.length)return fail('请先选择需要修改的记录。');
    const originals=getRows(current,kind,scope);
    if(!Array.isArray(originals))return fail('原始记录不可用，请重新打开该模块。');
    const existing=new Map(originals.map(item=>[text(item?.id),item]));
    if(unique.some(id=>!id||!existing.has(id)))return fail('选择的记录已变化，请重新选择。');
    const raw=text(value).trim();
    const options=CHOICES[`${kind}:${field}`];
    if(options&&!options.some(([v])=>v===raw))return fail('请选择有效的目标状态。');
    if(field==='expiryDate'&&raw&&!validDate(raw))return fail('有效期必须是有效日期，或留空清除。');
    if(field==='quantityDelta'&&(!/^[-+]?\d+(?:\.\d{1,3})?$/.test(raw)||Math.abs(Number(raw))>100000000))return fail('库存调整值必须是合理的数字，最多三位小数。');
    if(field==='quantityDelta'&&unique.some(id=>Number(existing.get(id)?.quantity||0)+Number(raw)<0))return fail('部分库存减量后会低于零，整个操作已取消。');
    if(field==='price'&&(!/^\d+(?:\.\d{1,2})?$/.test(raw)||!Number.isFinite(Number(raw))))return fail('价格必须是非负数字，最多两位小数。');
    if(['category','location','currency'].includes(field)&&!raw)return fail('目标值不能为空。');
    if(['tagsAdd','tagsRemove','notesAppend'].includes(field)&&!raw)return fail('请输入需要添加或移除的内容。');
    if(['tagsAdd','tagsRemove'].includes(field)&&!raw.split(',').some(x=>x.trim()))return fail('标签不能为空。');
    const candidate=JSON.parse(JSON.stringify(current));
    const rows=getRows(candidate,kind,scope),selected=new Set(unique),changed=[];
    for(const item of rows){
      if(!selected.has(text(item.id)))continue;
      const before=JSON.stringify(item);
      if(field==='tagsAdd'){
        item.tags=[...new Set([...(Array.isArray(item.tags)?item.tags:[]),...raw.split(',').map(x=>x.trim()).filter(Boolean)])];
      }else if(field==='tagsRemove'){
        const unwanted=new Set(raw.split(',').map(x=>x.trim()).filter(Boolean));
        item.tags=(Array.isArray(item.tags)?item.tags:[]).filter(x=>!unwanted.has(x));
      }else if(field==='quantityDelta'){
        const oldQuantity=Number(item.quantity)||0,nextQuantity=Math.round((oldQuantity+Number(raw))*1000)/1000;
        if(nextQuantity!==oldQuantity){
          item.quantity=nextQuantity;
          item.history=Array.isArray(item.history)?item.history:[];
          item.history.push({id:`inventory-bulk-${now}-${text(item.id)}`,date:new Date(now).toISOString(),kind:'manual_adjustment',message:'批量库存调整',oldQuantity,newQuantity:nextQuantity,quantityDelta:nextQuantity-oldQuantity});
        }
      }else if(field==='price')item.price=Number(raw);
      else if(field==='lowStockEnabled'||field==='autoRenew')item[field]=raw==='true';
      else if(field==='notesAppend')item.notes=[text(item.notes).trim(),raw].filter(Boolean).join('\n');
      else item[field]=raw;
      if(JSON.stringify(item)!==before){item.updatedAt=now;changed.push(text(item.id));}
    }
    if(!changed.length)return fail('选中的记录已是目标值，无需保存。');
    if(kind==='inventory'&&(field==='category'||field==='location')){
      const key=field==='category'?'categories':'locations';
      candidate.inventory[key]=Array.isArray(candidate.inventory[key])?candidate.inventory[key]:[];
      if(!candidate.inventory[key].includes(raw))candidate.inventory[key].push(raw);
    }
    if(kind==='wishlist'&&field==='notesAppend'){
      // List-level edits do not touch nested wish items.
    }
    if(kind==='wishItem'){
      const list=candidate.wishlists.find(x=>text(x?.id)===text(scope));
      list.updatedAt=now;
    }
    return {ok:true,candidate,kind,scope,changedIds:changed,selectedCount:unique.length,changedCount:changed.length,field,value:raw};
  }
  let bindings=null;
  const active=new Map();
  const key=(kind,scope='')=>`${kind}|${text(scope)}`;
  const esc=s=>text(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  function state(kind,scope=''){
    const k=key(kind,scope);
    if(!active.has(k))active.set(k,{enabled:false,selected:new Set(),visible:[],scope:text(scope)});
    return active.get(k);
  }
  function render(kind,scope=''){bindings?.render?.(kind,scope);}
  function toolbar(kind,visibleIds,scope=''){
    const id=kind==='wishItem'?'wishItemBulkToolbar':`${kind}BulkToolbar`,host=document.getElementById(id);
    if(!host)return;
    const st=state(kind,scope);
    st.visible=[...new Set((visibleIds||[]).map(text))];
    const a=`'${esc(kind)}','${esc(scope)}'`;
    if(!st.enabled){host.innerHTML=`<button class="ghost" type="button" onclick="appBulkToggle(${a})">☑ 批量修改</button>`;return;}
    const count=st.selected.size;
    host.innerHTML=`<div class="app-bulk-toolbar"><span aria-live="polite">已选 ${count} 条${scope?'（当前清单）':''}</span><button type="button" class="ghost" onclick="appBulkSelectVisible(${a})">全选当前结果</button><button type="button" class="ghost" onclick="appBulkClear(${a})">清空选择</button><button type="button" class="btn primary" ${count?'':'disabled'} onclick="appBulkOpen(${a})">修改所选</button><button type="button" class="ghost" onclick="appBulkToggle(${a})">完成</button></div>`;
  }
  function row(kind,id,markup,scope=''){
    const st=state(kind,scope);
    if(!st.enabled)return markup;
    return `<div class="app-bulk-row"><label class="app-bulk-pick"><input type="checkbox" aria-label="选择${esc(LABELS[kind]||'记录')}" ${st.selected.has(text(id))?'checked':''} onchange="appBulkCheck('${esc(kind)}','${esc(scope)}','${esc(id)}',this.checked)"><span>选择</span></label>${markup}</div>`;
  }
  function toggle(kind,scope=''){
    const st=state(kind,scope);st.enabled=!st.enabled;st.selected.clear();render(kind,scope);
  }
  function check(kind,scope,id,checked){const st=state(kind,scope);if(!st.enabled)return;checked?st.selected.add(text(id)):st.selected.delete(text(id));toolbar(kind,st.visible,scope);}
  function selectVisible(kind,scope=''){const st=state(kind,scope);if(!st.enabled)return;st.visible.forEach(id=>st.selected.add(id));render(kind,scope);}
  function clear(kind,scope=''){const st=state(kind,scope);st.selected.clear();render(kind,scope);}
  let editing=null;
  function fieldChanged(){
    const field=document.getElementById('appBulkField')?.value||'',control=document.getElementById('appBulkValueHost');if(!editing||!control)return;
    const choices=CHOICES[`${editing.kind}:${field}`];
    if(choices)control.innerHTML=`<select id="appBulkValue">${choices.map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join('')}</select>`;
    else if(field==='expiryDate')control.innerHTML='<input id="appBulkValue" type="date"><p class="small">留空表示清除有效期</p>';
    else if(field==='quantityDelta')control.innerHTML='<input id="appBulkValue" type="number" step="0.001" placeholder="例如 +3 或 -2"><p class="small">对每条所选记录增减相同数量；不会直接覆盖现有库存数量。</p>';
    else if(field==='price')control.innerHTML='<input id="appBulkValue" type="number" step="0.01" min="0" placeholder="新的统一价格">';
    else control.innerHTML=`<input id="appBulkValue" placeholder="${field==='tagsAdd'||field==='tagsRemove'?'多个标签用逗号分隔':field==='notesAppend'?'追加到原备注末尾':'填写目标值'}">`;
  }
  function open(kind,scope=''){
    const st=state(kind,scope);if(!st.enabled||!st.selected.size)return;
    editing={kind,scope};
    const fields=FIELD_DEFS[kind];
    const label=document.getElementById('appBulkTitle'),summary=document.getElementById('appBulkSummary'),el=document.getElementById('appBulkField');
    label.textContent=`批量修改${LABELS[kind]}`;summary.textContent=`共选中 ${st.selected.size} 条；仅修改指定字段，其他内容不变。`;
    el.innerHTML=fields.map(([value,name])=>`<option value="${esc(value)}">${esc(name)}</option>`).join('');
    fieldChanged();bindings?.modal?.open('appBulkModal');
  }
  function close(){editing=null;bindings?.modal?.close('appBulkModal');}
  function save(){
    if(!editing||!bindings)return {ok:false,message:'未开始批量修改'};
    const {kind,scope}=editing,st=state(kind,scope),field=document.getElementById('appBulkField')?.value,value=document.getElementById('appBulkValue')?.value;
    const built=buildAppBulkCandidate(bindings.getState(),{kind,scope,ids:[...st.selected],field,value});
    if(!built.ok){alert(built.message);return built;}
    if(!confirm(`将修改 ${built.changedCount} 条${LABELS[kind]}的「${FIELD_DEFS[kind].find(x=>x[0]===field)?.[1]}」，其他字段不变。确定保存吗？`))return {ok:false,message:'用户取消'};
    const result=bindings.commit(built.candidate,{kind,scope,changedIds:built.changedIds});
    if(!result?.ok){alert(`批量保存失败：${result?.message||'写入与回读验证失败'}。请不要清除 App 数据。`);return result;}
    st.selected.clear();st.enabled=false;
    close();render(kind,scope);return result;
  }
  function bind(ctx){bindings=ctx;}
  Object.assign(window,{appBulkToggle:toggle,appBulkCheck:check,appBulkSelectVisible:selectVisible,appBulkClear:clear,appBulkOpen:open,appBulkClose:close,appBulkFieldChanged:fieldChanged,appBulkSave:save});
  window.JournalModules=window.JournalModules||{};
  window.JournalModules.appBulk={buildAppBulkCandidate,FIELD_DEFS,bind,toolbar,row,state};
})();
