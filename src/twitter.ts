// Setting things up.
import * as http from 'http';
import * as Twit from 'twit';

// howsmydriving-utils
import { IRegion, ICitation, Citation, CitationIds } from 'howsmydriving-utils';
import { DumpObject, PrintTweet } from 'howsmydriving-utils';
import { CompareNumericStrings } from 'howsmydriving-utils';
import { sleep } from 'howsmydriving-utils';

import { ITweet, ITwitterUser, IGetTweetsResponse } from './interfaces';

// legacy commonjs modules
const fs = require('fs'),
  soap = require('soap');

const INTER_TWEET_DELAY_MS =
  process.env.hasOwnProperty('INTER_TWEET_DELAY_MS') &&
  CompareNumericStrings(process.env.INTER_TWEET_DELAY_MS, '0') < 0
    ? parseInt(process.env.INTER_TWEET_DELAY_MS, 10)
    : 5000;

const botScreenNameRegexp: RegExp = new RegExp(
  '@' + process.env.TWITTER_HANDLE + '\\b',
  'i'
);

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

// Set the screen_name default to be what's in .env files
bot_info.screen_name = process.env.TWITTER_HANDLE
  ? process.env.TWITTER_HANDLE
  : '';

// We need the bot's app id to detect tweets from the bot
getAccount(new Twit(config.twitter))
  .then(twitter_user => {
    bot_info.id = twitter_user.id;
    bot_info.id_str = twitter_user.id_str;
    bot_info.screen_name = twitter_user.screen_name;

    log.info(
      `Loaded Twitter bot's info: id: ${bot_info.id} id_str: ${bot_info.id_str} screen_name: ${bot_info.screen_name}.`
    );
  })
  .catch(err => {
    handleError(err);
  });

export function GetNewTweets(
  last_mention_id: string,
  bot_account_name: string = process.env.TWITTER_HANDLE
): Promise<IGetTweetsResponse> {
  const T: Twit = new Twit(config.twitter);
  let maxTweetIdRead: string = last_mention_id;

  return new Promise<IGetTweetsResponse>((resolve, reject) => {
    if (!last_mention_id) {
      reject(new Error('ERROR: last_mention_id must be provided.!'));
      return;
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
  return sendTweetsInternal(
    new Twit(config.twitter),
    region_name,
    orig_tweet,
    tweet_strings
  );
}

function sendTweetsInternal(
  T: Twit,
  region_name: string,
  orig_tweet: ITweet,
  tweet_strings: Array<string>
): Promise<number> {
  log.info(`checking length of tweet_strings...`);
  if (tweet_strings.length == 0) {
    log.info(`checked length of tweet_strings and it is empty.`);
    // return an promise that is already resolved, ending the recursive
    // chain of promises that have been built.
    return Promise.resolve(0);
  }
  log.info(`checked length of tweet_strings and it is not empty.`);

  // Clone the tweet_strings array so we don't modify the one passed to us
  var tweet_strings_clone: Array<string> = [...tweet_strings];
  var tweet_string: string = tweet_strings_clone.shift();

  // When doing the initial reply to the user's tweet, we need to include their
  // twitter account in the text of the tweet (i.e. @orig_tweet.user.screen_name).
  // But when replying to our own replies, we should not include our own mention
  // or else those tweets will show up in the timelines of everyone who
  // follows the bot.
  log.info(`orig_tweet: ${DumpObject(orig_tweet)}.`);
  if (!orig_tweet || !orig_tweet.user) {
    log.info(`About to crash: ${DumpObject(orig_tweet)}.`);
  }

  if (!IsMe(orig_tweet.user.id_str)) {
    tweet_string = '@' + orig_tweet.user.screen_name + ' ' + tweet_string;
  }

  return new Promise<number>((resolve, reject) => {
    let tweets_sent: number = 0;

    log.info(
      `About to truncate tweet_string ${tweet_string} to 100 characters.`
    );
    log.debug(
      `Replying to tweet '${orig_tweet.id_str}': ${tweet_string.trunc(100)}.`
    );

    // There will be one thread running this for each request we are
    // processing. We need to make sure we don't send tweets in quick
    // succession or Twitter will tag them as spam and they won't
    // render i the thread of resposes.
    // So wait at least INTER_TWEET_DELAY_MS ms between posts.
    new Twit(config.twitter).post(
      'statuses/update',
      {
        status: tweet_string,
        in_reply_to_status_id: orig_tweet.id_str
      } as Twit.Params,
      (err: Error, data: ITweet) => {
        let twit_error_code: number = 0;

        if (err) {
          if (err.hasOwnProperty('code')) {
            twit_error_code = (err as any)['code'];
          }

          if (twit_error_code != 187) {
            reject(err);
            return;
          } else {
            log.info(`HMDWATwit: got 187 error from Twitter.`);
            // This appears to be a "status is a duplicate" error which
            // means we are trying to resend a tweet we already sent.
            // If the tweet we are replying to is not one of ours (i.e. the first
            // reply in our reply thread), then fail here because we can retry again
            // later and it should eventually succeed once the last tweet gets old
            // enough that Twitter no longer treats this as a duplicate.
            if (!IsMe(orig_tweet.id_str)) {
              log.info(
                `HMDWATwit: Detected we were replying to someone else's tweet. Creating DuplicateError.`
              );
              let err: Error = new Error(
                `Duplicate tweet detected. Try again later or add a unique id.`
              );
              err.name = 'DuplicateError';
              reject(err);
              return;
            } else {
              // It seems we started a reply thread and then one of the 2 thru n replies
              // was detected as a duplicate by Twitter. It seems this should never happen.
              // However, if it does, we are going to just pretend this tweet was successful
              // and move on to the next one in the thread. Failing halfway through a reply
              // thread would be difficult to recover from in a way that we can correctly
              // continue the thread later.
              log.info(
                `Error 187 sending tweet replyto id_str: ${orig_tweet.id_str}. Pretending successful.`
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
          log.info(
            `Sent tweet for region ${region_name} in response to id_str: ${
              orig_tweet.id_str
            }: ${PrintTweet(data)}`
          );
        }

        log.info(`Waiting before sending rest of tweets...`);

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
                log.info(
                  `sendTweetsInternal: inside catch for sendTweetsInternal. err: ${err}`
                );
                reject(err);
              });
          })
          .catch((err: Error) => {
            log.info(`sendTweetsInternal: inside catch for sleep. err: ${err}`);
            reject(err);
          });
      }
    );
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

function getAccount(T: Twit): Promise<Twit.Twitter.User> {
  return new Promise((resolve, reject) => {
    T.get(
      'account/verify_credentials',
      {},
      (err: Error, data: any, response: http.IncomingMessage) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      }
    );
  });
}

//? TODO: We should really be doing this by user ID, not screen name
function IsMe(id_str: string): boolean {
  log.info(`Checking if it is me: '${id_str}' '${bot_info.id_str}'`);
  return CompareNumericStrings(id_str, bot_info.id_str) == 0;
}
