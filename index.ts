const packpath = require('packpath');

import * as path from 'path';
import { log } from './src/logging';
import { __MODULE_NAME__, __MODULE_VERSION__ } from './src/logging';

export {
  IGetTweetsResponse,
  IImageDetails,
  IMediaUploadResponse,
  ITweet,
  ITwitterUser
} from './src/interfaces';

export { IMediaItem, MediaItem, MediaItemsFromString } from './src/mediaitem';

export { getBotUser } from './src/twitter';
export { GetNewTweets } from './src/twitter';
export { GetNewDMs } from './src/twitter';
export { GetTweetById } from './src/twitter';
export { SendTweets, UploadMedia } from './src/twitter';

log.info(
  `howsmydriving-twitter: Loading module ${__MODULE_NAME__} version ${__MODULE_VERSION__}.`
);
