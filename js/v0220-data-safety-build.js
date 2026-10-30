(function(){
  'use strict';
  const build='v0.23.9-order-bulk-edit-production-20261030';
  window.JOURNAL_BUILD=build;
  document.documentElement.dataset.runtimeBuild=build;
  window.dispatchEvent(new CustomEvent('journalBuildReady',{detail:{build,label:'Orders Bulk Edit Production'}}));
})();
