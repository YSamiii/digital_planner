(function(){
  'use strict';
  const build='0.22.0-historical-import-qa3-diagnostic';
  window.JOURNAL_BUILD=build;
  document.documentElement.dataset.runtimeBuild=build;
  window.dispatchEvent(new CustomEvent('journalBuildReady',{detail:{build,label:'Historical Import QA3 Diagnostic'}}));
})();
