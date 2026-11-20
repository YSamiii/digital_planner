(() => {
  const info = Object.freeze({
    appVersion: '0.24.3',
    build: 'v0.24.3-challenge-task-buttons-production-20261120',
    label: 'Challenge Task Buttons Production',
    assetVersion: '0243challengetaskbuttonsprod-20261120'
  });
  window.JOURNAL_BUILD_INFO = info;
  window.applyJournalBuildMarker = () => {
    window.APP_VERSION = info.appVersion;
    window.JOURNAL_BUILD = info.build;
    document.documentElement.dataset.build = info.build;
    document.documentElement.dataset.runtimeBuild = info.build;
    return info.build;
  };
  window.applyJournalBuildMarker();
})();