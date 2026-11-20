(function(){
  'use strict';
  // A schedule is a dated policy, never a rewrite of an existing check-in.
  const DAYS=['周一','周二','周三','周四','周五','周六','周日'];
  function fromISO(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return null;const date=new Date(String(value)+'T12:00:00');return Number.isFinite(date.getTime())?date:null;}
  function iso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function add(date,days){const value=fromISO(date);if(!value)return '';value.setDate(value.getDate()+days);return iso(value);}
  function dayOfWeek(date){const value=fromISO(date);return value?(value.getDay()+6)%7+1:0;}
  function monday(date){const value=fromISO(date);return value?add(date,1-((value.getDay()+6)%7+1)):'';}
  function nextMonday(date){return add(monday(date),7);}
  const DAILY={mode:'daily',weeklyTarget:7,weekdays:[1,2,3,4,5,6,7]};
  function normalize(spec){const raw=spec&&typeof spec==='object'?spec:{},mode=['daily','weekly_count','weekdays'].includes(raw.mode)?raw.mode:'daily',weeklyTarget=Math.max(1,Math.min(7,Math.floor(Number(raw.weeklyTarget)||1))),weekdays=[...new Set((Array.isArray(raw.weekdays)?raw.weekdays:[]).map(Number).filter(day=>Number.isInteger(day)&&day>=1&&day<=7))].sort((a,b)=>a-b);return mode==='daily'?{...DAILY}:mode==='weekly_count'?{mode,weeklyTarget,weekdays:[]}: {mode,weeklyTarget:weekdays.length,weekdays};}
  function revisions(challenge){return (Array.isArray(challenge?.frequencyHistory)?challenge.frequencyHistory:[]).filter(x=>fromISO(x?.effectiveFrom)).map(x=>({effectiveFrom:String(x.effectiveFrom),...normalize(x)})).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));}
  function at(challenge,date){let active=DAILY;for(const entry of revisions(challenge)){if(entry.effectiveFrom>date)break;active=entry;}return normalize(active);}
  function latest(challenge){const all=revisions(challenge);return all.length?normalize(all[all.length-1]):normalize(DAILY);}
  function range(challenge){const start=fromISO(challenge?.startDate)?challenge.startDate:'',end=fromISO(challenge?.endDate)?challenge.endDate:start&&Number(challenge.days)>0?add(start,Math.max(1,Math.floor(Number(challenge.days)))-1):'';return {start,end};}
  function inRange(challenge,date){const r=range(challenge);return !!(r.start&&r.end&&fromISO(date)&&date>=r.start&&date<=r.end);}
  function hasLegacyCheckin(challenge,date){return Array.isArray(challenge?.completedDates)&&challenge.completedDates.includes(date);}
  function checklistRules(challenge){const source=Array.isArray(challenge?.checklistRules)?challenge.checklistRules:Array.isArray(challenge?.rules)?challenge.rules:[];return source.map((rule,index)=>typeof rule==='string'?{id:`legacy-${index}`,title:rule,required:true,sortOrder:index}:{id:String(rule?.id||`legacy-${index}`),title:String(rule?.title||''),required:rule?.required!==false,sortOrder:Number.isFinite(Number(rule?.sortOrder))?Number(rule.sortOrder):index}).filter(rule=>rule.title.trim());}
  function isMultiTask(challenge){return challenge?.mode!=='score'&&challenge?.checklistTaskMode==='multi';}
  function checklistSnapshot(challenge,date){const saved=challenge?.dailyLogs?.[date]?.checklistRuleSnapshots;if(Array.isArray(saved))return saved.map((rule,index)=>({id:String(rule?.id||`snapshot-${index}`),title:String(rule?.title||''),required:rule?.required!==false,sortOrder:index}));return checklistRules(challenge);}
  function checklistProgress(challenge,date){const log=challenge?.dailyLogs?.[date]&&typeof challenge.dailyLogs[date]==='object'?challenge.dailyLogs[date]:{},rules=checklistSnapshot(challenge,date),required=rules.filter(rule=>rule.required),done=required.filter(rule=>log[rule.id]===true);return {rules,done:done.length,total:required.length,complete:required.length>0&&done.length===required.length,legacyCheckin:hasLegacyCheckin(challenge,date),hasSnapshot:Array.isArray(log.checklistRuleSnapshots)};}
  function hasCheckin(challenge,date){if(challenge?.mode==='score'){const log=challenge?.dailyLogs?.[date];return !!log&&typeof log==='object'&&Object.entries(log).some(([key,value])=>!['ruleNotes','ruleSnapshots','dailyNote','dayNote','checklistRuleSnapshots'].includes(key)&&value===true);}if(hasLegacyCheckin(challenge,date))return true;if(isMultiTask(challenge))return checklistProgress(challenge,date).complete;return false;}
  function scheduled(challenge,date){if(!inRange(challenge,date))return false;const spec=at(challenge,date);return spec.mode!=='weekdays'||spec.weekdays.includes(dayOfWeek(date));}
  function week(challenge,date){const start=monday(date);if(!start)return {mode:'daily',start:'',end:'',target:0,done:0,remaining:0,reached:false,todayScheduled:false,todayChecked:false,eligible:[],checked:[]};const end=add(start,6),r=range(challenge),begin=r.start&&r.start>start?r.start:start,finish=r.end&&r.end<end?r.end:end,anchor=begin,plan=at(challenge,anchor),eligible=[];
    if(r.start&&r.end&&begin<=finish){for(let i=0;i<7;i++){const dateValue=add(start,i);if(dateValue>=begin&&dateValue<=finish&&(plan.mode!=='weekdays'||plan.weekdays.includes(dayOfWeek(dateValue))))eligible.push(dateValue);}}
    const target=plan.mode==='weekly_count'?Math.min(plan.weeklyTarget,eligible.length):eligible.length,checked=eligible.filter(day=>hasCheckin(challenge,day));
    return {mode:plan.mode,start,end,target,done:checked.length,remaining:Math.max(0,target-checked.length),reached:target>0&&checked.length>=target,todayScheduled:eligible.includes(date),todayChecked:checked.includes(date),eligible,checked};
  }
  function shouldPromptToday(challenge,date){const row=week(challenge,date);if(!row.todayScheduled||row.todayChecked)return false;return row.mode!=='weekly_count'||!row.reached;}
  function weeklyStreak(challenge,date){let cursor=monday(date),streak=0;const earliest=range(challenge).start;if(!cursor||!earliest)return 0;for(let i=0;i<155&&cursor>=monday(earliest);i++,cursor=add(cursor,-7)){const w=week(challenge,cursor);if(!w.target)continue;if(i===0&&!w.reached)continue;if(!w.reached)break;streak++;}return streak;}
  function planLabel(plan){const spec=normalize(plan);return spec.mode==='weekly_count'?`每周 ${spec.weeklyTarget} 天`:spec.mode==='weekdays'?`每周：${spec.weekdays.map(n=>DAYS[n-1]).join('、')}`:'每天';}
  function newRevision(challenge,spec,from){const next=revisions(challenge).filter(x=>x.effectiveFrom!==from);next.push({effectiveFrom:from,...normalize(spec)});return next.sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));}
  window.JournalModules=window.JournalModules||{};
  window.JournalModules.challengeSchedule={DAYS,today:()=>iso(new Date()),add,monday,nextMonday,normalize,revisions,at,latest,range,inRange,hasCheckin,hasLegacyCheckin,checklistRules,isMultiTask,checklistSnapshot,checklistProgress,scheduled,week,shouldPromptToday,weeklyStreak,planLabel,newRevision};
})();
