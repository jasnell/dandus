"use strict";

var express = require('express');
var DB = require('./lib/store');
var env = require('./config/env');
var url = require('url');
var problem = require('http-problem');
var activitystreams_context = require('activitystreams-context');
var problem_context = require('./lib/problem.json');

var app = env.init();

app.use(function(req, res, next) {
  var _url = url.parse(env.appBase + req.originalUrl);
  delete _url.query;
  delete _url.search;
  req.fullURL = url.format(_url);
  next();
});

DB(env, function(db) {

  app.use(function(err, req, res, next) {
    console.error(err.stack);
    if (err.problem) {
      err.problem['@context'] = env.problemBase;
      err.problem.send(res);
    } else {
      var p = problem.raise({status:500,detail:err.message});
      p.problem['@context'] = env.problemBase;
      p.send(res);
  }
  });

  require('./lib/service')(app, db, env);

  function setContextHeaders(res) {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/ld+json',
      'Cache-Control': 'public, max-age=86400'
    });
  }

  app.get('/context', function(req, res, next) {
    process.nextTick(function() {
      setContextHeaders(res);
      res.end(JSON.stringify(activitystreams_context), 'utf-8');
    });
  });

  app.get('/problem', function(req, res, next) {
    process.nextTick(function() {
      setContextHeaders(res);
      res.end(JSON.stringify(problem_context), 'utf-8');
    });
  });

  app.listen(env.listenPort, env.listenHost);
  console.log('App started on port ' + env.listenPort);
}, 
function(err) {
  console.log(err);
});

