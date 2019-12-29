const packpath = require('packpath');
const appRootDir = require('app-root-dir').get();
const appRootPath = require('app-root-path');
const appRoot = require('app-root');

import * as path from 'path';

let packpath_parent = packpath.parent() ? packpath.parent() : packpath.self();
let packpath_self = packpath.self();

console.log(
  `howsmydriving-twitter:\n - packpath_self: ${packpath_self}\n - packpath_parent: ${packpath.parent()}\n - app-root-dir: ${appRootDir}\n - app-root-path: ${appRootPath}\n - app-root (current): see below\n - app-root (root): see below\n - __dirname: ${__dirname}\n - .: ${path.resolve(
    '.'
  )}`
);

appRoot({
  directory: '.',
  success: function(roots) {
    console.log(`howsmydriving-twitter:\n - app-root (current): ${roots}`);
  }
});

appRoot({
  directory: '/',
  success: function(roots) {
    console.log(`howsmydriving-twitter:\n - app-root (root): ${roots}`);
  }
});

export const log4js_config_path = path.resolve(
  appRootDir + '/dist/config/log4js.json'
);

console.log(
  `howsmydriving-twitter: log4js_config_path:\n - ${log4js_config_path}`
);

// Dependeing on whether we are running unittests or under node_modules hosted within an
// app, we are either one level below, or two levels below package.json.
let package_config_path = path.resolve(packpath_parent + '/package.json');

var pjson = require(package_config_path);

// Put this at very top so other modules can import it without taking
// dependencies on something else in the module being instantiated.
export const __MODULE_NAME__ = pjson.name;
export const __MODULE_VERSION__ = pjson.version;

export { ITweet } from './src/interfaces';
export { ITwitterUser } from './src/interfaces';
export { IGetTweetsResponse } from './src/interfaces';

export { GetNewTweets } from './src/twitter';
export { GetNewDMs } from './src/twitter';
export { GetTweetById } from './src/twitter';
export { SendTweets } from './src/twitter';

import { log } from './src/logging';

console.log(
  `howsmydriving-twitter: package_config_path: ${package_config_path}, __MODULE_NAME__: ${__MODULE_NAME__}, __MODULE_VERSION__": ${__MODULE_VERSION__}.`
);
