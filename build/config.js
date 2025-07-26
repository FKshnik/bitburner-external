const fileSyncJson = require('../filesync.json');
const dist = fileSyncJson['scriptsFolder'];
const src = 'src';
const allowedFiletypes = fileSyncJson['allowedFiletypes'];
const ignoredDirectories = [
  "lib"
];

module.exports = {
  dist,
  src,
  allowedFiletypes,
  ignoredDirectories,
};
