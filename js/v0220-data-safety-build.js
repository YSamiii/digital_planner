(function(){
  'use strict';
  const build='v0.23.7-auto-order-lifecycle-fix-production-qa2-candidate-20261021';
  window.JOURNAL_BUILD=build;
  document.documentElement.dataset.runtimeBuild=build;
  window.dispatchEvent(new CustomEvent('journalBuildReady',{detail:{build,label:'Auto Order Lifecycle Fix Production QA2 Candidate'}}));
})();
