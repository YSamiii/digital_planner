(function(){
  'use strict';
  // Pure, side-effect-free candidate builder. The caller is responsible for
  // committing the entire candidate atomically and verifying its read-back.
  const STATUS_BY_TYPE={
    direct:['ordered','preparing','shipped','in_transit','out_for_delivery','delivered'],
    pickup:['ordered','preparing','ready_pickup','picked_up'],
    local:['ordered','preparing','scheduled','out_for_delivery','delivered']
  };
  const FORWARDING_STAGES=[
    'ordered','not_received_warehouse','received_warehouse','waiting_pack',
    'waiting_payment','waiting_dispatch','waiting_departure','departed',
    'arrived_port','arrived_airport','arrived_hub','customs_or_processing',
    'rail_transit','on_rail','truck_transit','local_transit',
    'arrived_destination_hub','destination_hub_processing',
    'waiting_pickup_point','at_pickup_point','picked_up'
  ];
  const FIELDS=new Set(['status','batch','independentStatus','orderDate','expectedDate','tagsAdd','tagsRemove','archived']);
  const fail=message=>({ok:false,message});
  const str=value=>String(value??'');
  const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(`${value}T12:00:00Z`).toISOString().startsWith(value);
  const isDeleted=o=>o?.deleted===true||!!o?.deletedAt||o?.tombstoned===true;
  function buildOrderBulkCandidate(current,ids,field,value,{now=Date.now()}={}){
    if(!FIELDS.has(field))return fail('请选择受支持的修改字段。');
    const unique=[...new Set((ids||[]).map(str))];
    if(!unique.length)return fail('请先选择订单。');
    const existing=current?.orders?.items;
    if(!Array.isArray(existing))return fail('订单数据不可用。');
    const old=new Map(existing.map(o=>[str(o?.id),o]));
    if(unique.some(id=>!old.has(id)||isDeleted(old.get(id))))return fail('所选订单已改变，请重新选择。');
    const records=unique.map(id=>old.get(id));
    const raw=str(value).trim();
    const batchMap=new Map((current.orders?.forwardingBatches||[]).map(b=>[str(b.id),b]));
    if(field==='status'){
      if(records.some(o=>o.fulfillmentType==='forwarding'))return fail('批量订单状态仅适用于非集运订单。请使用「集运独立状态」修改集运订单。');
      if(records.some(o=>(o.orderType==='recurring-generated'||o.sourceRecurringId)&&o.status==='draft'))return fail('自动订购待确认草稿不能批量确认；请逐条确认以安全推进周期。');
      if(records.some(o=>!(STATUS_BY_TYPE[o.fulfillmentType||'direct']||STATUS_BY_TYPE.direct).includes(raw)))return fail('目标状态不适用于全部已选订单，请按履约方式筛选后修改。');
    }
    if(field==='batch'||field==='independentStatus'){
      if(records.some(o=>o.fulfillmentType!=='forwarding'))return fail('集运批次和独立物流状态仅适用于集运订单，请先筛选集运。');
      if(field==='batch'&&raw&&!batchMap.has(raw))return fail('目标集运批次不存在，请重新选择。');
      if(field==='independentStatus'&&raw&&!FORWARDING_STAGES.includes(raw)&&!records.some(o=>str(o.forwarding?.independentStatus)===raw))return fail('未知物流状态，请重新选择。');
    }
    if(field==='orderDate'&&(!validDate(raw)||records.some(o=>o.orderType==='recurring-generated'||o.sourceRecurringId)))return fail('订单日期必须有效；自动订购订单的周期日期不能批量修改。');
    if(field==='expectedDate'&&raw&&!validDate(raw))return fail('预计到达日期无效。');
    if((field==='tagsAdd'||field==='tagsRemove')&&!raw)return fail('请填写要修改的标签。');
    if(field==='archived'&&!['true','false'].includes(raw))return fail('请选择归档或恢复。');
    const tags=raw.split(',').map(s=>s.trim()).filter(Boolean);
    const candidate=JSON.parse(JSON.stringify(current));
    const selected=new Set(unique),changed=[];
    for(const order of candidate.orders.items){
      if(!selected.has(str(order.id)))continue;
      const before=JSON.stringify(order);
      if(field==='status')order.status=raw;
      else if(field==='batch'){
        const forwarding=order.forwarding||(order.forwarding={});
        const formerId=str(forwarding.batchId),former=batchMap.get(formerId);
        // Detaching an inherited order must not unexpectedly reset its stage.
        if(!raw&&formerId&&!str(forwarding.independentStatus)&&former?.currentStage){forwarding.independentStatus=str(former.currentStage);}
        forwarding.batchId=raw;
      }else if(field==='independentStatus'){
        const forwarding=order.forwarding||(order.forwarding={});
        forwarding.independentStatus=raw;
      }else if(field==='orderDate')order.orderDate=raw;
      else if(field==='expectedDate')order.expectedDate=raw;
      else if(field==='tagsAdd')order.tags=[...new Set([...(Array.isArray(order.tags)?order.tags:[]),...tags])];
      else if(field==='tagsRemove')order.tags=(Array.isArray(order.tags)?order.tags:[]).filter(t=>!tags.includes(t));
      else if(field==='archived'){
        order.archived=raw==='true';
        if(raw==='false')order.archivedAt=null;
      }
      if(JSON.stringify(order)!==before){order.updatedAt=now;changed.push(str(order.id));}
    }
    if(!changed.length)return fail('所选订单已是目标值，无需保存。');
    return {ok:true,candidate,selectedCount:unique.length,changedCount:changed.length,changedIds:changed,field,value:raw};
  }
  const root=window.JournalModules=window.JournalModules||{};
  root.orderBulk={buildOrderBulkCandidate,STATUS_BY_TYPE,FORWARDING_STAGES};
})();
