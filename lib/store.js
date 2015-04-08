'use strict';

var db   = require('./db');
var ldp  = require('./ldp');
var util = require('util');
var as   = require('activitystrea.ms');
var EventEmitter = require('events').EventEmitter;

function throwif(condition, message) {
  if (condition) { throw new Error(message); }
}

function DB(env, callback, onerr) {
  if (!(this instanceof DB)) {
    return new DB(env, callback);
  }
  var self = this;
  EventEmitter.call(this);
  if (typeof callback === 'function') {
    this.once('ready', callback);
  }
  if (typeof onerr === 'function') {
    this.once('error', onerr);
  }
  db(env, 'dandus', function(err, instance) {
    if (err) {
      self.emit('error', err);
      return;
    }
    self.database = instance;
    console.log('Database Ready, Connected to:', instance.config.db);
    self.emit('ready', self);
  });
}
util.inherits(DB, EventEmitter);

DB.prototype.reserveURI = function(uri, callback) {
  throwif(!this.database, 'Database not initialized');
  this.database.insert({}, uri,
    function(err, result) {
      if (err) {
        callback(err);
        return;
      }
      callback(null,{
        id: result.id,
        rev: result.rev
      });
    }
  );
};

DB.prototype.releaseURI = function(doc) {
  throwif(!this.database, 'Database not initialized');
  this.database.destroy(
    doc.id, doc.rev, 
    function(err) {
      if (err) {
        console.log(err.stack);
      }
    }
  );
};

DB.prototype.put = function(id, doc, callback) {
  throwif(!this.database, 'Database not initialized');
  this.database.insert(doc, id, callback);
};

DB.prototype.get = function(id, callback) {
  throwif(!this.database, 'Database not initialized');
  this.database.get(id, function(err,result) {
    if (err) {
      callback(err.message === 'missing' ? null : err);
      return;
    }
    callback(null,result);
  });
};

DB.prototype.getContainment = function(id, callback) {
  throwif(!this.database, 'Database not initialized');
  var limit = 2;
  this.database.search('search', 'containment', 
    {
      q:'containedBy:"'+id+'" && deleted:false',
      include_docs: false,
      sort: '["timestamp<number>"]',
      limit: limit
    },
    function(err,docs) {
      if (err) {
        callback(err);
        return;
      }
      var result = [];
      if (docs && docs.total_rows > 0) {
        for (var n = 0, l = docs.rows.length; n < l; n++) {
          result.push(docs.rows[n]);
        }
      }
      callback(null,result);
    });

};

var default_limit = 25;
var max_limit = 200;

function ranged(val,min,max) {
  return Math.max(min,Math.min(max,val));
}

DB.prototype.getPagedContainment = function(id, query, callback) {
  throwif(!this.database, 'Database not initialized');
  var database = this.database;

  var limit = ranged(parseInt(query.limit)||default_limit,1,max_limit);
  var bookmark = query.bookmark;
  var q_fence = query.fence;
  var q_actor = query.actor;
  var q_type =  as.vocabs.as[query.type] || query.type;
  var fence;
  if (q_fence) {
    var _fence = q_fence.split(',',3);
    if (_fence.length > 1) {
      var longitude = ranged(parseFloat(_fence[0]||0,-180.0,180.0));
      var latitude = ranged(parseFloat(_fence[0]||0,-90.0,90.0));
      var unit = _fence[2] || 'km';
      if (unit !== 'km' && unit !== 'mi') unit = 'km';
      fence = util.format('["-<distance,longitude,latitude,%d,%d,%s>"]',longitude, latitude,unit);
    }
  }
  var qry = util.format('containedBy:"%s" && deleted:false', id);
  if (q_actor) {
    qry = util.format('actor:"%s" && ',q_actor) + qry;
  }
  if (q_type) {
    qry = util.format('type:"%s" && ',q_type) + qry;
  }
  var since = Date.parse(qry.since);
  if (since) {
    qry += util.format(' && timestamp:[%d TO Infinity]',since+1);
  }
  var options = {
    q: qry,
    include_docs: true,
    sort: fence || '["-timestamp<number>"]',
    limit: limit
  };
  if (bookmark) {
    options.bookmark = bookmark;
  }
  database.search('search', 'containment', 
    options,
    function(err,docs) {
      if (err) {
        callback(err);
        return;
      }
      var result = [];
      var ret_bookmark;
      var total_rows = 0;
      if (docs && docs.total_rows > 0) {
        for (var n = 0, l = docs.rows.length; n < l; n++) {
          var row = docs.rows[n];
          result.push({id:row.id,triples:row.doc.triples});
        }
        ret_bookmark = docs.bookmark;
        total_rows = docs.total_rows;
      }
      callback(null,result, {
        bookmark: ret_bookmark,
        total_rows: total_rows,
        limit: limit,
        since: query.since,
        fence: query.fence,
        actor: query.actor,
        type: query.type});
    });
};

DB.prototype.findContainer = function(uri, callback) {
  this.get(uri, function(err, ret) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, ret.interactionModel === ldp.BasicContainer ? ret : null);
  });
};

module.exports = DB;
