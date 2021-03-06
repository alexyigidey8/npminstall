'use strict';

const debug = require('debug')('npminstall:download:local');
const fs = require('mz/fs');
const path = require('path');
const chalk = require('chalk');
const uuid = require('uuid');
const utils = require('../utils');

module.exports = async (pkg, options) => {
  options.localPackages++;
  let filepath = pkg.spec;
  if (!path.isAbsolute(filepath)) {
    filepath = path.join(options.root, filepath);
  } else {
    // npa resolve './file/path' from process.cwd()
    // but we want to resolve from `options.root`
    if (pkg.rawSpec[0] === '.') {
      filepath = path.join(options.root, pkg.rawSpec);
    }
  }

  try {
    filepath = await fs.realpath(filepath);
    const stat = await fs.stat(filepath);
    return stat.isDirectory()
      ? await localFolder(filepath, pkg, options)
      : await localTarball(filepath, pkg, options);
  } catch (err) {
    throw new Error(`[${pkg.displayName}] resolved target ${filepath} error: ${err.message}`);
  }
};

async function localFolder(filepath, pkg, options) {
  debug(`install ${pkg.name}@${pkg.rawSpec} from local folder ${filepath}`);
  return await utils.copyInstall(filepath, options);
}

async function localTarball(filepath, pkg, options) {
  debug(`install ${pkg.name}@${pkg.rawSpec} from local tarball ${filepath}`);
  const readstream = fs.createReadStream(filepath);
  // everytime unpack to a different directory
  const ungzipDir = path.join(options.storeDir, '.tmp', uuid());
  await utils.mkdirp(ungzipDir);
  try {
    await utils.unpack(readstream, ungzipDir, pkg);
    return await utils.copyInstall(ungzipDir, options);
  } finally {
    // clean up
    try {
      await utils.rimraf(ungzipDir);
    } catch (err) {
      options.console.warn(chalk.yellow(`rmdir local ungzip dir: ${ungzipDir} error: ${err}, ignore it`));
    }
  }
}
