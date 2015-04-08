'use strict';

var nano = require('nano');
var url  = require('url');
var util = require('util');
var HttpsAgent = require('agentkeepalive').HttpsAgent;

var db;

function createClient(env) {
  var db = env.cloudant;
  var provider = db.provider;
  var username = db.username;
  var password = db.password;
  if ((username && username !== '') && 
      (password && password !== '')) {
    var parsed = url.parse(provider);
    parsed.auth = util.format('%s:%s', encodeURIComponent(username), encodeURIComponent(password));
    provider = url.format(parsed);
  }
  var agent = new HttpsAgent({
    maxSockets: 50,
    maxKeepAliveRequests: 10,
    maxKeepAliveTime: 30000
  });
  return nano({
    url: provider,
    requestDefaults: {
      agent: agent
    }
  });
}

module.exports = function(env, database, callback) {
  db = db || createClient(env);
  callback(null,db.use(database));
};

