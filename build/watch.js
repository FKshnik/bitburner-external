const fs = require('node:fs');
const path = require('node:path');
const syncDirectory = require('sync-directory');
const fg = require('fast-glob');
const chokidar = require('chokidar');
const { src, dist, allowedFiletypes, ignoredDirectories } = require('./config');

/** Format dist path for printing 
 * @param {string} p
*/
function normalize(p) {
  return p.replace(/\\/g, '/');
}

/** Checks if directory is ignored
 * @param {string} dir 
 */
function isDirectoryIgnored(dir) {
  return !ignoredDirectories.every((val) => !new RegExp(normalize(path.normalize(`/${val}/`))).test(normalize(dir)));
}

/**
 * Sync static files.
 * Include init and watch phase.
 */
async function syncStatic() {
  return syncDirectory.async(path.resolve(src), path.resolve(dist), {
    exclude: (file) => {
      const { dir, ext } = path.parse(file);
      return ext && !allowedFiletypes.includes(ext) || isDirectoryIgnored(file);
    },
    async afterEachSync(event) {
      // log file action
      let eventType;
      if (event.eventType === 'add' || event.eventType === 'init:copy') {
        eventType = 'changed';
      } else if (event.eventType === 'unlink') {
        eventType = 'deleted';
      }
      if (eventType) {
        let relative = event.relativePath;
        if (relative[0] === '\\') {
          relative = relative.substring(1);
        }
        console.log(`${normalize(relative)} ${eventType}`);
      }
    },
    watch: true,
    deleteOrphaned: true,
  });
}

/**
 * Sync ts script files.
 * Init phase only.
 */
async function initTypeScript() {
  const distFiles = await fg(`${dist}/**/*.ts`);
  for (const distFile of distFiles) {
    // search existing *.js file in dist
    const relative = path.relative(dist, distFile);
    const srcFile = path.resolve(src, relative);
    // if srcFile does not exist, delete distFile
    if (
      !fs.existsSync(srcFile)
    ) {
      await fs.promises.unlink(distFile);
      console.log(`${normalize(relative)} deleted`);
    }
  }
}

/**
 * Sync ts script files.
 * Watch phase only.
 */
async function watchTypeScript() {
  chokidar.watch(`${src}/**/*.ts`, {
    ignored: (file, stats) => isDirectoryIgnored(file)
  }).on('unlink', async (p) => {
    // called on *.ts file get deleted
    const relative = path.relative(src, p);
    const distFile = path.resolve(dist, relative);
    // if distFile exists, delete it
    if (fs.existsSync(distFile)) {
      await fs.promises.unlink(distFile);
      console.log(`${normalize(relative)} deleted`);
    }
  });
}

/**
 * Sync ts script files.
 * Include init and watch phase.
 */
async function syncTypeScript() {
  await initTypeScript();
  return watchTypeScript();
}

console.log('Start watching static and ts files...');
syncStatic();
syncTypeScript();
