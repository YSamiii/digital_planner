(function(){
  'use strict';
  const messages={
    structuredActions:{zh:'本周关键行动',en:'Weekly Key Actions'},addAction:{zh:'新增行动',en:'Add Action'},actionName:{zh:'行动名称',en:'Action name'},weeklyTarget:{zh:'每周目标次数',en:'Weekly target'},completionStandard:{zh:'完成标准（可选）',en:'Completion standard (optional)'},completed:{zh:'已完成',en:'Completed'},autoExecutionScore:{zh:'自动执行分数',en:'Automatic Execution Score'},noActions:{zh:'尚未添加结构化关键行动。',en:'No structured key actions yet.'},useStructured:{zh:'使用结构化行动列表',en:'Use structured action list'},remove:{zh:'删除',en:'Remove'},saveWeek:{zh:'保存本周',en:'Save Week'},cancel:{zh:'取消',en:'Cancel'},notes:{zh:'备注',en:'Notes'},weeklyReview:{zh:'每周复盘',en:'Weekly Review'},weekFocus:{zh:'本周重点 / 战术',en:'Weekly Focus / Tactics'},legacyActions:{zh:'本周关键行动（旧版文本）',en:'Weekly Key Actions (legacy text)'},legacyScore:{zh:'Execution Score（旧版手填）',en:'Execution Score (legacy manual)'},targetRange:{zh:'每周目标次数需为 1–7。',en:'Weekly target must be 1–7.'},actionNameRequired:{zh:'请填写行动名称。',en:'Please enter an action name.'},noTarget:{zh:'没有可计算的目标；自动分数为 0%。',en:'No measurable targets; automatic score is 0%.'},dayNames:{zh:['周一','周二','周三','周四','周五','周六','周日'],en:['Mon','Tue','Wed','Thu','Fri','Sat','Sun']}
  };
  function locale(){return String(document.documentElement.lang||'zh-CN').toLowerCase().startsWith('en')?'en':'zh';}
  function t(key,params={}){const value=messages[key]?.[locale()]??messages[key]?.zh??key;return typeof value==='string'?value.replace(/\{(\w+)\}/g,(_,name)=>String(params[name]??'')):value;}
  window.TwelveWeekI18n={locale,t,messages};
})();
