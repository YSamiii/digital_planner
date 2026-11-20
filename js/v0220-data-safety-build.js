(function(){
  'use strict';
  const build=window.applyJournalBuildMarker();
  const label=window.JOURNAL_BUILD_INFO.label;
  window.dispatchEvent(new CustomEvent('journalBuildReady',{detail:{build,label}}));
})();