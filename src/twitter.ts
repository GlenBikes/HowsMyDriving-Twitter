/* Setting things up. */
import * as http from 'http';
import { LMXClient, LMXBroker, Client } from 'live-mutex';
import * as Twit from 'twit';

// howsmydriving-utils
import { Citation } from 'howsmydriving-utils';
import { CitationIds } from 'howsmydriving-utils';
import { DumpObject } from 'howsmydriving-utils';
import { IRegion } from 'howsmydriving-utils';
import { ICitation } from 'howsmydriving-utils';
import { CompareNumericStrings } from 'howsmydriving-utils';
import { SplitLongLines } from 'howsmydriving-utils';
import { PrintTweet } from 'howsmydriving-utils';
import { ITweet, ITwitterUser } from './interfaces';

// legacy commonjs modules
const fs = require('fs'),
  path = require('path'),
  soap = require('soap');

let app_root_dir = require('app-root-dir').get();

let pjson = require(path.join(app_root_dir, 'package.json'));

export var __MODULE_NAME__: string = pjson.name;

// Mutex to ensure we don't have multiple requests processing the same tweets
const MUTEX_TWIT_POST_MAX_HOLD_MS: number = 100000,
  MUTEX_TWIT_POST_MAX_RETRIES: number = 5,
  MUTEX_TWIT_POST_MAX_WAIT_MS: number = 300000;

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

const MUTEX_KEY: { [index: string]: string } = {
  tweet_reading: '__HOWSMYDRIVING_TWEET_READING__',
  dm_reading: '__HOWSMYDRIVING_DM_READING__'
};

// One global broker for the live-mutex clients.
let mutex_broker = new LMXBroker({});
var mutex_client: Client;

mutex_broker.emitter.on('warning', function() {
  log.warn(...arguments);
});

mutex_broker.emitter.on('error', function() {
  log.error(...arguments);
});

mutex_broker.ensure().then(() => {
  log.debug(`Successfully created mutex broker.`);

  log.debug(`Creating mutex client.`);
  mutex_client = new LMXClient();

  mutex_client.emitter.on('info', function() {
    log.debug(...arguments);
  });

  mutex_client.emitter.on('warning', function() {
    log.warn(...arguments);
  });

  mutex_client.emitter.on('error', function() {
    log.error(...arguments);
  });

  mutex_client
    .connect()
    .then(client => {
      log.info(`Successfully created mutex client.`);
    })
    .catch((err: Error) => {
      log.info(`Failed to connect mutex client. Err: ${err}.`);
      handleError(err);
    });
});

export function GetNewTweets(
  last_mention_id: string,
  bot_app_id: number
): Promise<Array<ITweet>> {
  const T: Twit = new Twit(config.twitter);
  let maxTweetIdRead: string = last_mention_id;

  if (!last_mention_id) {
    handleError(new Error('ERROR: last_mention_id must be provided.!'));
  }

  // Collect promises from these operations so they can go in parallel
  var twitter_promises: Array<Promise<void>> = [];

  return new Promise<Array<ITweet>>((resolve, reject) => {
    // Make sure we are the only process doing this or else we'll get dupes.
    let acquired_mutex = {
      key: '',
      id: ''
    };
    mutex_client
      .acquireLock(MUTEX_KEY['tweet_reading'], {
        ttl: MUTEX_TWIT_POST_MAX_HOLD_MS,
        maxRetries: MUTEX_TWIT_POST_MAX_RETRIES,
        lockRequestTimeout: MUTEX_TWIT_POST_MAX_WAIT_MS
      })
      .then(v => {
        log.debug(`Acquired mutex ${v.id} and received key ${v.key}.`);
        acquired_mutex.key = v.key;
        acquired_mutex.id = v.id;

        log.debug(`Checking for tweets greater than ${last_mention_id}.`);
        /* Next, let's search for Tweets that mention our bot, starting after the last mention we responded to. */
        T.get(
          'search/tweets',
          {
            q: '%40' + process.env.TWITTER_HANDLE,
            since_id: last_mention_id,
            tweet_mode: 'extended'
          },
          function(
            err: Error,
            data: Twit.Twitter.SearchResults,
            response: http.IncomingMessage
          ) {
            if (err) {
              handleError(err);
            }

            var tweets_read: Array<ITweet> = [];

            if (data.statuses.length) {
              /* 
            Iterate over each tweet. 

            The replies can occur concurrently, but the threaded replies to each tweet must, 
            within that thread, execute sequentially. 

            Since each tweet with a mention is processed in parallel, keep track of largest ID
            and write that at the end.
            */
              data.statuses.forEach((status: Twit.Twitter.Status) => {
                if (CompareNumericStrings(maxTweetIdRead, status.id_str) < 0) {
                  maxTweetIdRead = status.id_str;
                }

                /*
              Make sure this isn't a reply to one of the bot's tweets which would
              include the bot screen name in full_text, but only due to replies.
              */
                const { chomped, chomped_text } = chompTweet(status);

                if (!chomped || botScreenNameRegexp.test(chomped_text)) {
                  /* Don't reply to retweet or our own tweets. */
                  if (status.hasOwnProperty('retweet_status')) {
                    log.info(`Ignoring retweet: ${status.full_text}`);
                  } else if (status.user.id == bot_app_id) {
                    log.info('Ignoring our own tweet: ' + status.full_text);
                  } else {
                    log.info(`Found ${PrintTweet(status)}`);

                    var tweet: ITweet = {
                      id: status.id,
                      id_str: status.id_str,
                      user: {
                        id: status.user.id,
                        id_str: status.user.id_str,
                        screen_name: status.user.screen_name
                      }
                    };
                  }

                  tweets_read.push(tweet);
                } else {
                  log.info(
                    "Ignoring reply that didn't actually reference bot: " +
                      status.full_text
                  );
                }
              });
            } else {
              /* No new mentions since the last time we checked. */
              log.info('No new mentions...');
            }

            resolve(tweets_read);
          }
        );
      })
      .catch((err: Error) => {
        handleError(err);
      })
      .finally(() => {
        log.debug(
          `Releasing mutex key=${acquired_mutex.key}, id:${acquired_mutex.id}...`
        );
        mutex_client.releaseLock(acquired_mutex.key, {
          id: acquired_mutex.id,
          force: true
        });
        log.debug(
          `Released mutex key=${acquired_mutex.key}, id:${acquired_mutex.id}...`
        );
      });
  });
}

export function GetNewDMs(last_dm_id: string): Promise<Array<ITweet>> {
  var maxDmIdRead = -1;

  if (!last_dm_id) {
    handleError(new Error('ERROR: last_dm_id must be specified.'));
  }

  var ret: Array<ITweet> = [];
  var dm_promise = Promise.resolve(ret);
  // Make sure we are the only process doing this or else we'll get dupes.
  let acquired_mutex = {
    key: '',
    id: ''
  };
  mutex_client
    .acquireLock(MUTEX_KEY['dm_processing'], {
      ttl: MUTEX_TWIT_POST_MAX_HOLD_MS,
      maxRetries: MUTEX_TWIT_POST_MAX_RETRIES,
      lockRequestTimeout: MUTEX_TWIT_POST_MAX_WAIT_MS
    })
    .then(v => {
      log.debug(`Acquired mutex ${v.id} and received key ${v.key}.`);
      acquired_mutex.key = v.key;
      acquired_mutex.id = v.id;

      /**
       *  TODO: Implement DM handling.
       **/
    })
    .catch((err: Error) => {
      handleError(err);
    })
    .finally(() => {
      log.debug(
        `Releasing mutex key=${acquired_mutex.key}, id:${acquired_mutex.id}...`
      );
      mutex_client.releaseLock(acquired_mutex.key, {
        id: acquired_mutex.id,
        force: true
      });
      log.debug(
        `Released mutex key=${acquired_mutex.key}, id:${acquired_mutex.id}...`
      );
    });

  return dm_promise;
}

export function chompTweet(tweet: Twit.Twitter.Status) {
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
  var formattedError = `===============================================================================\n${error.message}\n${stacktrace}`;

  log.error(formattedError);
  throw error;
}

function getTweetById(id: string): Promise<ITweet> {
  // Quick check to fetch a specific tweet.
  const T: Twit = new Twit(config.twitter);
  return new Promise<ITweet>((resolve, reject) => {
    var retTweet;

    T.get(
      `statuses/show/${id}`,
      { tweet_mode: 'extended' },
      (
        err: Error,
        tweet: Twit.Twitter.Status,
        response: http.IncomingMessage
      ) => {
        if (err) {
          handleError(err);
          reject(tweet);
        }

        resolve(tweet);
      }
    );
  });
}

function getAccountID(T: Twit): Promise<number> {
  return new Promise((resolve, reject) => {
    T.get(
      'account/verify_credentials',
      {},
      (err: Error, data: any, response: http.IncomingMessage) => {
        if (err) {
          handleError(err);
        }
        resolve(data.id);
      }
    );
  });
}
