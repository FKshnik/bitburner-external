const fileSyncJson = require('../filesync.json');
const dist = fileSyncJson['scriptsFolder'];
const src = 'src';
const allowedFiletypes = fileSyncJson['allowedFiletypes'];
const ignoredDirectories = fileSyncJson['ignoredDirectories'];

module.exports = {
  dist,
  src,
  allowedFiletypes,
  ignoredDirectories,
};
