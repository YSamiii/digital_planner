(function(){
  'use strict';
  const build='0.22.2-inventory-use-one-qa2';
  window.JOURNAL_BUILD=build;
  document.documentElement.dataset.runtimeBuild=build;
  window.dispatchEvent(new CustomEvent('journalBuildReady',{detail:{build,label:'Inventory Use One iPhone QA2'}}));
})();
