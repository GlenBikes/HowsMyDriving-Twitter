import { GetNewTweets } from '../src/twitter';
import { createTweet } from './mocks/twitter';
import { uuidv1 } from '../src/util/stringutils';
import * as strUtils from '../src/util/stringutils';

var assert = require('assert'),
  sinon = require('sinon'),
  path = require('path');

export const tableNames: { [tabletype: string]: string } = {
  Request: `${process.env.DB_PREFIX}_Request`,
  Citations: `${process.env.DB_PREFIX}_Citations`,
  ReportItems: `${process.env.DB_PREFIX}_ReportItems`
};

describe('Tweet handling', function() {
  describe('Handle tweet with reference', function() {
    it('should write a single request to Request table', () => {
      // Use the fake timer (now is 0).
      var now = new Date().valueOf();
      var stubNow = sinon.stub(Date, 'now').returns(now);

      const stubUuid = sinon
        .stub(strUtils, 'uuidv1')
        .returns('4887b7a0-09a1-11ea-a100-f9a53a6b0433');

      var T: any = {
        get: (path: string, params: any, cb: any) => {
          var data = {
            statuses: [
              createTweet({
                id: 123,
                id_str: '123',
                full_text: `Hey ${process.env.TWITTER_HANDLE} can you look up TX:78DFSD for me?`,
                user: {
                  id: 1,
                  id_str: '2',
                  screen_name: 'fakeuser'
                }
              })
            ]
          };

          cb(null, data, null);
        }
      };

      return new Promise((resolve, reject) => {
        GetNewTweets('1', 12)
          .then(tweets => {
            resolve();
          })
          .catch((err: Error) => {
            reject(err);
          })
          .finally(() => {});
      });
    });
  });

  describe('Handle tweet without license', function() {
    it('should write a single request to Request table, saying no license', () => {
      var T = {
        get: (path: string, params: any, cb: any) => {
          var data = {
            statuses: [
              createTweet({
                id: 123,
                id_str: '123',
                full_text: `Hey ${process.env.TWITTER_HANDLE} can you look up TX_78DFSD for me?`,
                user: {
                  id: 2,
                  id_str: '3',
                  screen_name: 'fakeyuser'
                }
              })
            ]
          };

          cb(null, data, null);
        }
      };

      return new Promise((resolve, reject) => {
        GetNewTweets('123', 456)
          .then(tweets => {
            resolve();
          })
          .catch((err: Error) => {
            reject(err);
          })
          .finally(() => {});
      });
    });
  });

  describe('Handle multiple tweets', function() {
    it('should write one request to Request table for each tweet', () => {
      var T = {
        get: (path: string, params: any, cb: any) => {
          var data = {
            statuses: [
              createTweet({
                id: 123,
                id_str: '123',
                full_text: `Hey ${process.env.TWITTER_HANDLE} can you look up TX_78DFSD for me?`,
                user: {
                  id: 4321,
                  id_str: '4321',
                  screen_name: 'dummyuser'
                }
              })
            ]
          };

          cb(null, data, null);
        }
      };

      return new Promise((resolve, reject) => {
        GetNewTweets('999', 1)
          .then(tweets => {
            resolve();
          })
          .catch((err: Error) => {
            throw err;
          })
          .finally(() => {});
      });
    });
  });
});
