const packpath = require('packpath');

import * as path from 'path';
export { ITweet } from './src/interfaces';
export { ITwitterUser } from './src/interfaces';
export { IGetTweetsResponse } from './src/interfaces';

export { GetNewTweets } from './src/twitter';
export { GetNewDMs } from './src/twitter';
export { GetTweetById } from './src/twitter';
export { SendTweets } from './src/twitter';

import { log } from './src/logging';

import { __MODULE_NAME__, __MODULE_VERSION__ } from './src/logging';

log.info(
  `howsmydriving-twitter: Loading module ${__MODULE_NAME__} version ${__MODULE_VERSION__}.`
);
