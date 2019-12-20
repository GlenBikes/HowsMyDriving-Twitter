import * as path from 'path';
import * as fs from 'file-system';

// Put this at very top so other modules can import it without taking
// dependencies on something else in the module being instantiated.
export var __MODULE_VERSION__: string;
export var __MODULE_NAME__: string;

// Dependeing on whether we are running unittests or under node_modules hosted within an
// app, we are either one level below, or two levels below package.json.
let package_config_path = path.resolve(__dirname + '/../package.json');

if (!fs.existsSync(package_config_path)) {
  package_config_path = path.resolve(
    package_config_path + '/../../package.json'
  );

  if (!fs.existsSync(package_config_path)) {
    throw new Error(`package.config not found: ${package_config_path}.`);
  }
}

console.log(`Loading ${package_config_path}.`);

var pjson = require(package_config_path);

__MODULE_NAME__ = pjson.name;
__MODULE_VERSION__ = pjson.version;

console.log(`__MODULE_NAME__: ${__MODULE_NAME__}.`);

const chokidar = require('chokidar'),
  log4js = require('log4js');

console.log(`Loading ${path.resolve(__dirname + '/../config/log4js.json')}.`);
const config_path = path.resolve(__dirname + '/../config/log4js.json');

// Load the config.
console.log('Configuring log4js.');
log4js.configure(config_path);

// Create default logger to log that our module was loaded and for
// config update changes.
console.log('Getting logger.');
export var log = log4js.getLogger('result');

console.log(`Setting 'module' context value to : ${__MODULE_NAME__}.`);
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
  log.info(`Reloading log config due to config file ${reason}.`);
  log4js.shutdown(() => {
    log4js.configure(config_path);
    log = log4js.getLogger('reason');

    log.addContext('module', __MODULE_NAME__);
  });
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
