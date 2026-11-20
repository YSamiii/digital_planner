(function(){
  'use strict';
  const build='v0.24.1-challenge-weekly-schedule-production-20261120';
  window.JOURNAL_BUILD=build;
  document.documentElement.dataset.runtimeBuild=build;
  window.dispatchEvent(new CustomEvent('journalBuildReady',{detail:{build,label:'Challenge Weekly Schedule Production'}}));
})();
