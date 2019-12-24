import { DumpObject } from 'howsmydriving-utils';

import { GetNewTweets } from '../src/twitter';

var assert = require('assert'),
  sinon = require('sinon'),
  path = require('path');

describe('Tweet search', function() {
  describe('Manual test of a change to search query', function() {
    it('should assert truth', () => {
      assert(true);
      /*
      GetNewTweets('1209299859104092161', 'HowsMyDrivingWA').then(tweets => {
        console.log(DumpObject(tweets));
      });
      */
    });
  });
});
