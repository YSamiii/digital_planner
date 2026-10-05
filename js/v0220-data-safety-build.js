(function(){
  'use strict';
  const build='v0.23.1-storage-quota-safety-iphone-qa1-20261005';
  window.JOURNAL_BUILD=build;
  document.documentElement.dataset.runtimeBuild=build;
  window.dispatchEvent(new CustomEvent('journalBuildReady',{detail:{build,label:'Storage Quota Safety iPhone QA1'}}));
})();
