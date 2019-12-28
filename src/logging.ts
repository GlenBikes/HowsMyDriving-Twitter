import { sleep } from 'howsmydriving-utils';
const packpath = require('packpath');

import * as path from 'path';
import * as fs from 'file-system';

// Put this at very top so other modules can import it without taking
// dependencies on something else in the module being instantiated.
export var __MODULE_VERSION__: string;
export var __MODULE_NAME__: string;

let packpath_parent = packpath.parent() ? packpath.parent() : packpath.self();
let packpath_self = packpath.self();

// Dependeing on whether we are running unittests or under node_modules hosted within an
// app, we are either one level below, or two levels below package.json.
let package_config_path = path.resolve(packpath_self + '/package.json');

var pjson = require(package_config_path);

__MODULE_NAME__ = pjson.name;
__MODULE_VERSION__ = pjson.version;

const chokidar = require('chokidar'),
  log4js = require('log4js');

const config_path = path.resolve(packpath_self + '/dist/config/log4js.json');

// Load the config.
log4js.configure(config_path);

// Create default logger to log that our module was loaded and for
// config update changes.
export var log = log4js.getLogger('result');

log.addContext('module', __MODULE_NAME__);

/**
 * Monitor the log4js config file and reloading log instances if the file changes.
 **/
var watcher = chokidar.watch(config_path, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  awaitWriteFinish: true
});

/**
 * Reload log4js (when config changes).
 *
 * Params:
 *   reason: Reason why logs are being reloaded. This is logged before
 *           reloading log4js.
 *
 * TODO: Test to make sure this works. Do existing loggers still work? Do
 *       they update to the new log level?
 **/
function reloadlog(reason: string) {
  /*
  log.info(`Reloading log config due to config file ${reason}.`);
  log4js.shutdown(() => {
    sleep(10000).then(() => {
      log4js.configure(config_path);
      log = log4js.getLogger('reason');

      log.addContext('module', __MODULE_NAME__);
    });
  });
  */
}

// Handle the change/add events for the log4js config file.
watcher
  .on('add', (path: string) => {
    reloadlog(`add of ${path}`);
  })
  .on('change', (path: string) => {
    reloadlog(`change of ${path}`);
  });

log.info(`Module ${__MODULE_NAME__} version '${__MODULE_VERSION__}' loaded.`);
