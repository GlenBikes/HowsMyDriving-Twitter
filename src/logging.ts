import { sleep } from 'howsmydriving-utils';

import { log4js_config_path } from '../index';

const chokidar = require('chokidar'),
  log4js = require('log4js'),
  path = require('path');

// Load the config.
log4js.configure(log4js_config_path);

// Create default logger to log that our module was loaded and for
// config update changes.
export var log = log4js.getLogger('result');

import { __MODULE_NAME__, __MODULE_VERSION__ } from '../index';

log.addContext('module', __MODULE_NAME__);
log.info(
  `howsmydriving-twitter: __MODULE_NAME__: ${__MODULE_NAME__}, __MODULE_VERSION__": ${__MODULE_VERSION__}.`
);

/**
 * Monitor the log4js config file and reloading log instances if the file changes.
 **/
var watcher = chokidar.watch(log4js_config_path, {
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
      log4js.configure(log4js_config_path);
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
