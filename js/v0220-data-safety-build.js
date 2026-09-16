(function(){
  'use strict';
  const build='0.22.3-inventory-stable-sort-qa';
  window.JOURNAL_BUILD=build;
  document.documentElement.dataset.runtimeBuild=build;
  window.dispatchEvent(new CustomEvent('journalBuildReady',{detail:{build,label:'Inventory Stable Sort iPhone QA'}}));
})();
