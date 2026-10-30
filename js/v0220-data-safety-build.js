(function(){
  'use strict';
  const build='v0.24.0-app-wide-bulk-production-20261030';
  window.JOURNAL_BUILD=build;
  document.documentElement.dataset.runtimeBuild=build;
  window.dispatchEvent(new CustomEvent('journalBuildReady',{detail:{build,label:'App-Wide Bulk Edit Production'}}));
})();
