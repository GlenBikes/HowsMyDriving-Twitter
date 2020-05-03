const fs = require('fs');

import { downloadFile, UploadMedia } from '../src/twitter';

import { log } from '../src/logging';

var assert = require('assert'),
  sinon = require('sinon'),
  path = require('path');

describe('Media item handling', function() {
  describe('Download file', function() {
    it('should download image', function(done) {
      let url: string =
        'https://maps.googleapis.com/maps/api/staticmap?markers=47.58841060132358,-122.30582739649397&zoom=14&size=400x400&key=AIzaSyCK7loPQ04_Ec3uPZIHTPLuTdz1kYU1_xk';
      let downloaded = false;
      var downloadedFileName;

      console.log(`Downloading ${url}...`);

      downloadFile(url)
        .then(fileName => {
          try {
            console.log(`Downloaded ${url} to ${fileName}.`);

            downloadedFileName = fileName;

            assert(downloadedFileName);
            assert(downloadedFileName.length > 0);
            done();
          } finally {
            fs.unlink(fileName, err => {
              if (err) {
                log.error(`Failed to delete temp file ${fileName}: ${err}`);
                throw err;
              }

              console.log(`Temp file ${fileName} deleted.`);
            });
          }
        })
        .catch(err => {
          console.log(`Error: ${err}`);
          throw err;
        });
    });
  });

  describe('Upload image', function() {
    it('should upload image', function(done) {
      let url: string =
        'https://maps.googleapis.com/maps/api/staticmap?markers=47.58841060132358,-122.30582739649397&zoom=14&size=400x400&key=AIzaSyCK7loPQ04_Ec3uPZIHTPLuTdz1kYU1_xk';

      console.log(`Uploading ${url}...`);

      UploadMedia('unittest_region', url, 'unittest alt text').then(
        media_item => {
          console.log(
            `Uploaded ${url} to media id ${media_item.twitter_media_id_str}.`
          );

          assert(media_item);
          assert(
            media_item.twitter_media_id_str &&
              parseInt(media_item.twitter_media_id_str) > 0
          );
          done();
        }
      );
    });
  });
});
