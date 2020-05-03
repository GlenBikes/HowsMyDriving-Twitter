// Setting things up.
import * as http from 'http';
import * as mime from 'mime';
import * as Twit from 'twit';

// howsmydriving-utils
import {
  ICitation,
  Citation,
  CitationIds,
  CompareNumericStrings,
  DumpObject,
  IMediaItem,
  MediaItem,
  MediaItemsFromString,
  PrintTweet,
  IRegion,
  sleep,
  ITweet,
  ITwitterUser
} from 'howsmydriving-utils';

import { IGetTweetsResponse, IMediaUploadResponse } from './interfaces/twitter';

// legacy commonjs modules
const { DownloaderHelper } = require('node-downloader-helper');
const fs = require('fs'),
  mime = require('mime'),
  soap = require('soap'),
  temp = require('temp');

const INTER_TWEET_DELAY_MS =
  process.env.hasOwnProperty('INTER_TWEET_DELAY_MS') &&
  CompareNumericStrings(process.env.INTER_TWEET_DELAY_MS, '0') < 0
    ? parseInt(process.env.INTER_TWEET_DELAY_MS, 10)
    : 5000;

const botScreenNameRegexp: RegExp = new RegExp(
  '@' + process.env.TWITTER_HANDLE + '\\b',
  'i'
);

const __HOWSMYDRIVING_DELIMITER__ = '||';

const config: any = {
  twitter: {
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
  }
};

import { log } from './logging';

var bot_info: ITwitterUser = {} as ITwitterUser;

// Create the media download temp folder
let media_download_dir = temp.mkdirSync('.mediadownload__');
log.debug(`Created media download directory ${media_download_dir}.`);

// We need the bot's app id to detect tweets from the bot
getBotUser()
  .then(user => {
    bot_info = user;
    log.info(
      `Loaded Twitter bot's info: id: ${bot_info.id} id_str: ${bot_info.id_str} screen_name: ${bot_info.screen_name}.`
    );
  })
  .catch(err => {
    handleError(err);
  });

// Set the screen_name default to be what's in .env files
bot_info.screen_name = process.env.TWITTER_HANDLE
  ? process.env.TWITTER_HANDLE
  : '';

/*
log.info(`config: ${DumpObject(config)}`);
uploadTwitterMedia()
  .then((media_id_str: string) => {
    log.info(`YAYYYYYYY!!!!!!!!! Got media_id_str: ${media_id_str}.`);
  })
  .catch((err: Error) => {
    log.error(`BOOOOOOO!!!!! Failed to get media_id_str: ${err}`);
  });
*/
/*
  new Twit(config.twitter),
  'https://maps.googleapis.com/maps/api/staticmap?markers=47.58841060132358,-122.30582739649397&zoom=14&size=400x400&key=AIzaSyCK7loPQ04_Ec3uPZIHTPLuTdz1kYU1_xk',
  'This is where the collision occurred'
  */

export function GetNewTweets(
  last_mention_id: string,
  bot_account_name: string = process.env.TWITTER_HANDLE
): Promise<IGetTweetsResponse> {
  const T: Twit = new Twit(config.twitter);
  let maxTweetIdRead: string = last_mention_id;

  return new Promise<IGetTweetsResponse>((resolve, reject) => {
    if (!last_mention_id) {
      reject(new Error('ERROR: last_mention_id must be provided.!'));
    }

    // Collect promises from these operations so they can go in parallel
    var twitter_promises: Array<Promise<void>> = [];

    log.debug(`Checking for tweets greater than ${last_mention_id}.`);
    /* Next, let's search for Tweets that mention our bot, starting after the last mention we responded to. */
    T.get(
      'search/tweets',
      {
        q: '%40' + bot_account_name,
        since_id: last_mention_id,
        tweet_mode: 'extended'
      },
      function(
        err: Error,
        data: Twit.Twitter.SearchResults,
        response: http.IncomingMessage
      ) {
        if (err) {
          reject(err);
          return;
        }

        var tweets_read: Array<ITweet> = [];

        if (data.statuses.length) {
          /**
           * Iterate over each tweet.
           *
           * The replies can occur concurrently, but the threaded replies to each tweet must,
           * within that thread, execute sequentially.
           *
           * Since each tweet with a mention is processed in parallel, keep track of largest ID
           * and write that at the end.
           **/
          log.debug(`Found ${data.statuses.length} tweets.`);

          data.statuses.forEach((status: Twit.Twitter.Status) => {
            if (CompareNumericStrings(maxTweetIdRead, status.id_str) < 0) {
              maxTweetIdRead = status.id_str;
            }

            /**
             * Make sure this isn't a reply to one of the bot's tweets which would
             * include the bot screen name in full_text, but only due to replies.
             **/
            const { chomped, chomped_text } = chompTweet(status);

            if (!chomped || botScreenNameRegexp.test(chomped_text)) {
              /* Don't reply to retweet or our own tweets. */
              if (status.hasOwnProperty('retweeted_status')) {
                log.debug(
                  `Ignoring retweet (by ${status.user.screen_name}): ${status.full_text}`
                );
              } else if (status.user.id == bot_info.id) {
                log.debug('Ignoring our own tweet: ' + status.full_text);
              } else {
                log.debug(`Found ${PrintTweet(status)}`);

                var tweet: ITweet = {
                  id: status.id,
                  id_str: status.id_str,
                  full_text: status.full_text,
                  user: {
                    id: status.user.id,
                    id_str: status.user.id_str,
                    screen_name: status.user.screen_name
                  }
                };

                tweets_read.push(tweet);
              }
            } else {
              log.debug(
                `Ignoring reply (by ${status.user.screen_name}) that didn't actually reference bot: ${status.full_text}`
              );
            }
          });
        } else {
          /* No new mentions since the last time we checked. */
          log.debug('No new mentions...');
        }

        let ret: IGetTweetsResponse = {
          tweets: tweets_read,
          last_tweet_read_id: maxTweetIdRead
        } as IGetTweetsResponse;

        resolve(ret);
      }
    );
  });
}

export function GetNewDMs(last_dm_id: string): Promise<Array<ITweet>> {
  var maxDmIdRead = -1;

  if (!last_dm_id) {
    handleError(new Error('ERROR: last_dm_id must be specified.'));
  }

  var ret: Array<ITweet> = [];
  var dm_promise = Promise.resolve(ret);

  /**
   *  TODO: Implement DM handling.
   **/

  return dm_promise;
}

export function SendTweets(
  region_name: string,
  orig_tweet: ITweet,
  tweet_strings: Array<string>
): Promise<number> {
  log.trace(
    `SendTweets: region: ${region_name}, orig_tweet: ${PrintTweet(
      orig_tweet
    )}, ${tweet_strings.length} tweets}`
  );

  return sendTweetsInternal(
    new Twit(config.twitter),
    region_name,
    orig_tweet,
    tweet_strings
  );
}

export function UploadMedia(
  region_name: string,
  url: string,
  alt_text: string
): Promise<MediaItem> {
  return new Promise<MediaItem>((resolve, reject) => {
    log.trace(
      `UploadMedia: region: ${region_name}, url: ${url}, alt_text: ${alt_text}`
    );

    let T: Twit = new Twit(config.twitter);

    uploadTwitterMedia(T, url, alt_text)
      .then(media_item => {
        log.debug(
          `UploadMedia: Successfully uploaded ${url} for region ${region_name}. Adding metadata...`
        );

        setMediaMetadata(media_item.twitter_media_id_str, alt_text).then(() => {
          resolve(media_item);
        });
      })
      .catch(err => {
        handleError(err);
      });
  });
}

function sendTweetsInternal(
  T: Twit,
  region_name: string,
  orig_tweet: ITweet,
  tweet_strings: Array<string>
): Promise<number> {
  log.trace(
    `sendTweetsInternal: region: ${region_name}, orig_tweet: ${PrintTweet(
      orig_tweet
    )}, tweet_strings (${tweet_strings.length})`
  );

  if (tweet_strings.length == 0) {
    // return an promise that is already resolved, ending the recursive
    // chain of promises that have been built.
    return Promise.resolve(0);
  }

  // Clone the tweet_strings array so we don't modify the one passed to us
  var tweet_strings_clone: Array<string> = [...tweet_strings];
  var tweet_string: string = tweet_strings_clone.shift();

  // When doing the initial reply to the user's tweet, we need to include their
  // twitter account in the text of the tweet (i.e. @orig_tweet.user.screen_name).
  // But when replying to our own replies, we should not include our own mention
  // or else those tweets will show up in the timelines of everyone who
  // follows the bot.
  if (
    orig_tweet &&
    orig_tweet.user &&
    orig_tweet.user.id_str &&
    !IsMe(orig_tweet.user.id_str)
  ) {
    tweet_string = '@' + orig_tweet.user.screen_name + ' ' + tweet_string;
  }

  // Check if there are images included with this tweet
  let media_items: Array<MediaItem> = [];
  let parts = tweet_string.split(__HOWSMYDRIVING_DELIMITER__);

  if (parts.length > 1) {
    // There are images specified for the tweet
    media_items = MediaItemsFromString(parts[1]);
    tweet_string = parts[0];
  }

  if (tweet_string.length >= 279) {
    throw new Error(
      `too long: ${tweet_string}, orig_tweet: ${PrintTweet(orig_tweet)}.`
    );
  }

  return new Promise<number>((resolve, reject) => {
    let tweets_sent: number = 0;

    log.debug(
      `Replying to tweet '${
        orig_tweet && orig_tweet.id_str ? orig_tweet.id_str : 'none'
      }': ${tweet_string.trunc(100)}.`
    );

    // There will be one thread running this for each request we are
    // processing. We need to make sure we don't send tweets in quick
    // succession or Twitter will tag them as spam and they won't
    // render i the thread of resposes.
    // So wait at least INTER_TWEET_DELAY_MS ms between posts.
    let params: Twit.Params = {
      status: tweet_string
    };

    if (orig_tweet) {
      params['in_reply_to_status_id'] = orig_tweet.id_str;
    }

    if (media_items.length > 0) {
      params['media_ids'] = media_items.map(
        ({ twitter_media_id_str }) => twitter_media_id_str
      );

      log.debug(`params[media_ids]: ${params['media_ids']}.`);
    }

    T.post('statuses/update', params, (err: Error, data: ITweet) => {
      let twit_error_code: number = 0;

      if (err) {
        if (err.hasOwnProperty('code')) {
          twit_error_code = (err as any)['code'];
        }

        if (twit_error_code != 187) {
          handleError(err);
        } else {
          log.info(`HMDWATwit: got 187 error from Twitter.`);
          // This appears to be a "status is a duplicate" error which
          // means we are trying to resend a tweet we already sent.
          // If the tweet we are replying to is not one of ours (i.e. the first
          // reply in our reply thread), then fail here because we can retry again
          // later and it should eventually succeed once the last tweet gets old
          // enough that Twitter no longer treats this as a duplicate.
          if (!orig_tweet || !orig_tweet.id || !IsMe(orig_tweet.user.id_str)) {
            log.info(`Returning DuplicateError to indicate this is retryable.`);
            let duplicate_error: Error = new Error(
              `Duplicate tweet detected. Try again later or add a unique id.`
            );
            duplicate_error.name = 'DuplicateError';
            reject(duplicate_error);
          } else {
            // It seems we started a reply thread and then one of the 2 thru n replies
            // was detected as a duplicate by Twitter. It seems this should never happen.
            // However, if it does, we are going to just pretend this tweet was successful
            // and move on to the next one in the thread. Failing halfway through a reply
            // thread would be difficult to recover from in a way that we can correctly
            // continue the thread later.
            log.info(
              `Error 187 but replying to our own tweet id_str: ${orig_tweet.id_str}. Pretending succeeded since no easy way to retry this.`
            );

            // Keep replying to the tweet we were told to reply to.
            // This means that in this scenario, if any of the rest of the tweets in this
            // thread have not been sent, they will create a new thread off the parent of
            // this one.
            // Not ideal, but the other alternatives are:
            // 1) Query for the previous duplicate tweet and then pass that along
            // 2) set all of the replies for this request to be PROCESSED even if they did not
            //    all get tweeted.
            data = orig_tweet;
          }
        }
      } else {
        tweets_sent++;
        log.debug(
          `Sent tweet for region ${region_name} in response to id_str: ${
            orig_tweet ? orig_tweet.id_str : 'none'
          }: ${PrintTweet(data)}`
        );
      }

      log.debug(`Waiting before sending rest of tweets...`);

      // Wait a bit. It seems tweeting a whackload of tweets in quick succession
      // can cause Twitter to think you're a troll bot or something and then some
      // of the tweets will not display for users other than the bot account.
      // See: https://twittercommunity.com/t/inconsistent-display-of-replies/117318/11
      sleep(tweet_strings_clone.length > 0 ? INTER_TWEET_DELAY_MS : 0)
        .then(() => {
          // Send the rest of the responses. When those are sent, then resolve
          // the local Promise.
          sendTweetsInternal(T, region_name, data, tweet_strings_clone)
            .then(tweets_sent_rest => {
              tweets_sent += tweets_sent_rest;
              resolve(tweets_sent);
            })
            .catch((err: Error) => {
              handleError(err);
            });
        })
        .catch((err: Error) => {
          handleError(err);
        });
    });
  });
}

function uploadTwitterMedia(
  T: Twit,
  image_url: string,
  alt_text: string
): Promise<MediaItem> {
  return new Promise<MediaItem>((resolve, reject) => {
    log.debug(`Uploading ${image_url} with alt_text: '${alt_text}'`);

    downloadFile(image_url)
      .then(downloadedFileName => {
        try {
          log.debug(
            `Downloaded ${image_url} to temp file ${downloadedFileName} which ${
              fs.existsSync(downloadedFileName) ? 'exists' : 'does not exist'
            }. Uploading to Twitter...`
          );

          T.post('media/upload', {
            command: 'INIT',
            media_type: mime.getType(downloadedFileName),
            total_bytes: fs.statSync(downloadedFileName).size
          } as Twit.Params)
            .then(result => {
              //              (bodyObj: IMediaUploadResponse, resp: http.IncomingMessage) => {
              var media_id_str = (result.data as any).media_id_string;

              var isStreamingFile = true;
              var isUploading = false;
              var segmentIndex = 0;
              log.debug(
                `Opening file ${downloadedFileName} which ${
                  fs.existsSync(downloadedFileName)
                    ? 'exists'
                    : 'does not exist'
                }`
              );
              var fStream = fs.createReadStream(downloadedFileName, {
                highWaterMark: 5 * 1024 * 1024
              });

              var _finalizeMedia = (media_id_str, cb) => {
                T.post(
                  'media/upload',
                  {
                    command: 'FINALIZE',
                    media_id: media_id_str
                  } as any,
                  cb
                );
              };

              var _checkFinalizeResp = (err, bodyObj, resp) => {
                log.debug(
                  `Finalized media upload for ${image_url}, media_id_str ${media_id_str}.`
                );

                resolve({
                  url: image_url,
                  alt_text: alt_text,
                  twitter_media_id_str: media_id_str
                });
              };

              fStream.on('data', buff => {
                log.debug(
                  `Data media upload for ${image_url}, media_id_str ${media_id_str}.`
                );
                fStream.pause();
                isStreamingFile = false;
                isUploading = true;

                T.post(
                  'media/upload',
                  {
                    command: 'APPEND',
                    media_id: media_id_str,
                    segment_index: segmentIndex,
                    media: buff.toString('base64')
                  } as any,
                  (err, bodyObj, resp) => {
                    log.debug(
                      `In T.post callback for media upload for ${image_url}, media_id_str ${media_id_str}.`
                    );

                    if (err) {
                      reject(err);
                    }

                    log.debug(
                      `In T.post callback for media upload for ${image_url}, media_id_str ${media_id_str}, setting isUploading to false.`
                    );

                    isUploading = false;

                    if (!isStreamingFile) {
                      _finalizeMedia(media_id_str, _checkFinalizeResp);
                    }
                  }
                );
              });

              fStream.on('end', () => {
                log.debug(
                  `On end of T.post media upload for ${image_url}, media_id_str ${media_id_str}.`
                );
                isStreamingFile = false;

                if (!isUploading) {
                  _finalizeMedia(media_id_str, _checkFinalizeResp);
                }
              });
            })
            .catch(err => {
              reject(err);
            })
            .finally(() => {
              fs.unlink(downloadedFileName, err => {
                if (err) {
                  log.error(
                    `Failed to delete temp file ${downloadedFileName}: ${err}`
                  );
                  throw err;
                }

                log.debug(`Temp file ${downloadedFileName} deleted.`);
              });
            });
        } finally {
          log.debug(`In finally for T.post for media upload for ${image_url}.`);
        }
      })
      .catch(err => {
        handleError(err);
      });
  });
}

function setMediaMetadata(media_id_str: string, alt_text: string) {
  const T: Twit = new Twit(config.twitter);

  return new Promise<void>((resolve, reject) => {
    let params = {
      media_id: media_id_str,
      alt_text: {
        text: alt_text.trunc(420)
      }
    };

    log.trace(
      `Setting alt_text for media item ${media_id_str} to '${alt_text}'...`
    );

    T.post(
      'media/metadata/create',
      params,
      (err: Error, data: ITweet, resp: http.IncomingMessage) => {
        if (err) {
          handleError(err);
        }

        log.trace(
          `Successfully set alt_text for media item ${media_id_str} to '${alt_text}'.`
        );

        // succeeded
        resolve();
      }
    );
  });
}

export function downloadFile(url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    log.debug(`Uploading ${url}'`);

    let filePath: string = temp.path({ suffix: '.tmp' });
    let pathSplit: Array<string> = filePath.split('/');
    let fileName: string = pathSplit[pathSplit.length - 1];

    // Download media (is there a way to stream it into Twit media/upload without downloading?
    const dl = new DownloaderHelper(url, media_download_dir, {
      fileName: fileName
    });

    log.debug(`Created DownloaderHelper for ${url}.'`);

    dl.on('download', downloadInfo =>
      log.debug(`Download of ${url} begins: {
        name: ${downloadInfo.fileName},
        total: ${downloadInfo.totalSize}
      }`)
    )
      .on('error', err => {
        log.debug(`error: ${err}`);
        handleError(err);
      })
      .on('retry', (attempt, opts) => {
        log.debug(
          'Retry Attempt:',
          attempt + '/' + opts.maxRetries,
          'Starts on:',
          opts.delay / 1000,
          'secs'
        );
      })
      .on('stateChanged', state => log.debug('State: ', state))
      .on('end', downloadInfo => {
        log.debug(
          `Downloaded ${url} to temp file ${downloadInfo.filePath} which ${
            fs.existsSync(downloadInfo.filePath) ? 'exists' : 'does not exist'
          }.`
        );
        resolve(downloadInfo.filePath);
      });

    dl.start();
  });
}

export function chompTweet(tweet: ITweet) {
  // Extended tweet objects include the screen name of the tweeting user within the full_text,
  // as well as all replied-to screen names in the case of a reply.
  // Strip off those because if UserA tweets a license plate and references the bot and then
  // UserB replies to UserA's tweet without explicitly referencing the bot, we do not want to
  // process that tweet.
  var chomped = false;
  var text = tweet.full_text;

  if (
    tweet.display_text_range != null &&
    tweet.display_text_range.length >= 2 &&
    tweet.display_text_range[0] > 0
  ) {
    text = tweet.full_text.substring(tweet.display_text_range[0]);
    chomped = true;
  }

  return {
    chomped: chomped,
    chomped_text: text
  };
}

function handleError(error: Error): void {
  // Truncate the callstack because only the first few lines are relevant to this code.
  var stacktrace = '';

  if (error.stack) {
    error.stack
      .split('\n')
      .slice(0, 10)
      .join('\n');
  }
  var formattedError = `${error.message}\n${stacktrace}`;

  log.error(formattedError);
  throw error;
}

export function GetTweetById(id: string): Promise<ITweet> {
  // Quick check to fetch a specific tweet.
  const T: Twit = new Twit(config.twitter);
  return new Promise<ITweet>((resolve, reject) => {
    var retTweet;

    log.debug(`Calling statuses/show/${id}`);
    T.get(
      `statuses/show/${id}`,
      { tweet_mode: 'extended' },
      (
        err: Error,
        tweet: Twit.Twitter.Status,
        response: http.IncomingMessage
      ) => {
        if (err) {
          reject(err);
        } else {
          log.debug(`Returning tweet: ${PrintTweet(tweet)}.`);
          resolve(tweet);
        }
      }
    );
  });
}

export function getBotUser(): Promise<ITwitterUser> {
  let T = new Twit(config.twitter);

  return new Promise<ITwitterUser>((resolve, reject) => {
    let user_info: ITwitterUser = {};

    T.get(
      'account/verify_credentials',
      {},
      (err: Error, data: any, response: http.IncomingMessage) => {
        if (err) {
          reject(err);
        } else {
          user_info.id = data.id;
          user_info.id_str = data.id_str;
          user_info.screen_name = data.screen_name;

          resolve(user_info);
        }
      }
    );
  });
}

function IsMe(id_str: string): boolean {
  log.trace(`IsMe: CompareNumeriStrings: ${id_str} and ${bot_info.id_str}`);

  let ret: boolean = CompareNumericStrings(id_str, bot_info.id_str) == 0;
  let result = ret ? 'It is me.' : 'It is not me.';
  log.trace(
    `Checking if it is me: '${id_str}' '${bot_info.id_str}'...${result}`
  );

  return ret;
}
