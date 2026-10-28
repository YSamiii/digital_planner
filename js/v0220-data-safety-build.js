(function(){
  'use strict';
  const build='v0.23.8-forwarding-status-persistence-production-20261028';
  window.JOURNAL_BUILD=build;
  document.documentElement.dataset.runtimeBuild=build;
  window.dispatchEvent(new CustomEvent('journalBuildReady',{detail:{build,label:'Forwarding Status Persistence Production'}}));
})();
