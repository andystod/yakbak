// Copyright 2016 Yahoo Inc.
// Licensed under the terms of the MIT license. Please see LICENSE file in the project root for terms.

var Promise = require('bluebird');
var hash = require('incoming-message-hash');
var assert = require('assert');
var mkdirp = require('mkdirp');
var path = require('path');
var buffer = require('./lib/buffer');
var proxy = require('./lib/proxy');
var record = require('./lib/record');
var curl = require('./lib/curl');
var debug = require('debug')('yakbak:server');
var jsonpath = require('jsonpath');


/**
 * Returns a new yakbak proxy middleware.
 * @param {String} host The hostname to proxy to
 * @param {Object} opts
 * @param {String} opts.dirname The tapes directory
 * @param {Boolean} opts.noRecord if true, requests will return a 404 error if the tape doesn't exist
 * @returns {Function}
 */

module.exports = function (host, opts) {
  assert(opts.dirname, 'You must provide opts.dirname');

  return function (req, res) {
    mkdirp.sync(opts.dirname);

    debug('req', req.url);

    return buffer(req).then(function (body) {
      var file = path.join(opts.dirname, tapename(req, body));

      return Promise.try(function () {
        return require.resolve(file);
      }).catch(ModuleNotFoundError, function (/* err */) {

        if (opts.noRecord) {
          throw new RecordingDisabledError('Recording Disabled');
        } else {
          return proxy(req, body, host).then(function (pres) {
            return record(req, pres, file);
          });
        }

      });
    }).then(function (file) {
      return require(file);
    }).then(function (tape) {
      return tape(req, res);
    }).catch(RecordingDisabledError, function (err) {
      /* eslint-disable no-console */
      console.log('An HTTP request has been made that yakbak does not know how to handle');
      console.log(curl.request(req));
      /* eslint-enable no-console */
      res.statusCode = err.status;
      res.end(err.message);
    });

  };

};

/**
 * Returns the tape name for `req`.
 * @param {http.IncomingMessage} req
 * @param {Array.<Buffer>} body
 * @returns {String}
 */


//TODO: add to separate file
function tapename(req, body) {

  var version;
  var service;
  var method;
  var token;
  var urlParts = req.url.toString().split('/');
  var tapeName;


  var bodyText = Buffer.concat(body).toString();

  if (urlParts[urlParts.length - 3] === 'oauth') {
    debug('oauth request');
    version = urlParts[urlParts.length - 2];
    service = urlParts[urlParts.length - 3];
    method = urlParts[urlParts.length - 1];

    var matches = bodyText.match(/username=(.*?)&/i);

    if (matches && matches.length > 1) {
      var userName = matches[1].toLowerCase();
      debug('username', userName);
      tapeName = service + '_' + method + '_' + version + '_' + userName + '.js';
    }
    else {
      debug('anonymous(or refresh?) oauth request');
      tapeName = service + '_' + method + '_' + version + '_anonymous.js';
    }

  }
  else {
    version = urlParts[urlParts.length - 3];
    service = urlParts[urlParts.length - 2];
    method = urlParts[urlParts.length - 1];
    token = req.headers['authorization'].split(' ')[1];

    tapeName = service + '_' + method + '_' + version + '_' + token;
    var serviceMethodIdentifier = service + '_' + method;
    var serviceMethodKeyData = keyData[serviceMethodIdentifier];

      serviceMethodKeyData.forEach(function (jsonpathExpression) {
        var keyValue = jsonpath.value(JSON.parse(bodyText), jsonpathExpression);
        // If value not found undefined will be appended (this will help identify jsonpath errors)
        tapeName += '_' + keyValue;
      });

    tapeName += '.js';
  }

  return tapeName;
}

/**
 * Bluebird error predicate for matching module not found errors.
 * @param {Error} err
 * @returns {Boolean}
 */

function ModuleNotFoundError(err) {
  return err.code === 'MODULE_NOT_FOUND';
}

/**
 * Error class that is thrown when an unmatched request
 * is encountered in noRecord mode
 * @constructor
 */

function RecordingDisabledError(message) {
  this.message = message;
  this.status = 404;
}

RecordingDisabledError.prototype = Object.create(Error.prototype);


var keyData = {
  "ConfigurationHelper_GetAppLaunchSettings":
  ["$..mobilePlatform", "$..id"]
};