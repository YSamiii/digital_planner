(function(){
  'use strict';
  const build='0.22.0-data-safety-p0-qa';
  window.JOURNAL_BUILD=build;
  document.documentElement.dataset.runtimeBuild=build;
  window.dispatchEvent(new CustomEvent('journalBuildReady',{detail:{build,label:'Data Safety P0 QA'}}));
})();
