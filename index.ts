const packpath = require('packpath');
const appRoot = require('app-root-dir').get();

import * as path from 'path';

let packpath_parent = packpath.parent() ? packpath.parent() : packpath.self();
let packpath_self = packpath.self();

export const log4js_config_path = path.resolve(
  appRoot + '/dist/config/log4js.json'
);

// Dependeing on whether we are running unittests or under node_modules hosted within an
// app, we are either one level below, or two levels below package.json.
let package_config_path = path.resolve(appRoot + '/package.json');
console.log(
  `howsmydriving-twitter: config path: ${package_config_path}, appRoot: ${appRoot}.`
);
console.log(
  `howsmydriving-twitter: packpath_self: ${packpath_self}, packpath_parent: ${packpath_parent}, appRoot: ${appRoot}, __dirname: ${__dirname}.`
);

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
