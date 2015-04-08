/**
 * Uses bits and pieces from https://github.com/spadgett/LDPjs/blob/master/env.js
 **/
'use strict';

var express = require('express');
var url     = require('url');
var path    = require('path');
var config  = require('./config.json');

// ********** LDP ********** //
function addSlash(url) {
  if (url.substr(-1) == '/') {
    return url;
  } else {
    return url + '/';
  }
}

function toURL(urlObj) {
  if ((urlObj.scheme === 'http' && urlObj.port === 80) ||
      (urlObj.scheme === 'https' && urlObj.port === 443)) {
    delete urlObj.port;
  }
  return url.format(urlObj);
}

exports.listenHost = process.env.VCAP_APP_HOST || config.host;
exports.listenPort = process.env.VCAP_APP_PORT || config.port;
exports.scheme = 'http'; //(process.env.VCAP_APP_PORT) ? 'http' :config.scheme;
//exports.host = 'localhost'; //process.env.VCAP_APP_HOST || config.host;
exports.host = 'dandus.mybluemix.net';
exports.port = 3000; //process.env.VCAP_APP_PORT || config.port;

exports.context = addSlash(config.context);

exports.appBase = toURL({
  protocol: exports.scheme,
  hostname: exports.host,
  //port: 3000
});
exports.ldpBase = toURL({
  protocol: exports.scheme,
  hostname: exports.host,
  //port: 3000,
  pathname: exports.context
});
exports.contextBase = toURL({
  protocol: exports.scheme,
  hostname: exports.host,
  //port: 3000,
  pathname: 'context'
});
exports.problemBase = toURL({
  protocol: exports.scheme,
  hostname: exports.host,
  //port: 3000,
  pathname: 'problem'
});

exports.sanitize = config.sanitize;
exports.cloudant = config.cloudant;
exports.maxcontentlength = config.maxcontentlength || 0;

// ********** Express ********** //

exports.init = function() {
  var app = express();
  return app;
};
