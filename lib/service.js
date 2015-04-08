'use strict';

var as         = require('activitystrea.ms');
var ldp        = require('./ldp');
var utils      = require('./utils');
var media      = require('./media');
var linkparser = require('parse-link-header');
var url        = require('url');
var etag       = require('etag');
var problem    = require('http-problem');

function reportServerError(res, env, message) {
  var p = problem.raise({status:500,detail:message});
  p['@context'] = env.problemBase;
  p.send(res);
}

function reportContentError(res, env, message) {
  var p = problem.raise({status:400,detail:message});
  p['@context'] = env.problemBase;
  p.send(res);
}

function getCollectionTriples(base) {
  return [{
    subject: base,
    predicate: as.vocabs.rdf.type,
    object: as.vocabs.as.Collection
  }];
}

function createRootContainer(base, db, callback) {
  db.reserveURI(base, function(err, rev) {
    if (err) {
      callback(err);
      return;
    }
    db.put(
      rev.id, {
        _id: rev.id,
        _rev: rev.rev,
        interactionModel: ldp.BasicContainer,
        triples: getCollectionTriples(base),
        deleted: false
      }, 
      function(err, result) {
        if (err) {
          db.releaseURI(base);
          callback(err);
          return;
        }
        callback(null,result);
      }
    );
  });
}

module.exports = function(app, db, env) {

  var sanitize = utils.sanitize.bind(env);

  function keepGoing() {
    var resource = app.route(env.context + '*');

    resource.all(function(req, res, next) {
      // Set the CORS header, we allow everything from everyone right now. Security!!! FTW!!!
      res.set({
        'Access-Control-Allow-Origin': '*'
      });
      next();
    });

    resource.all(function(err, req, res, next) {
      if (err.problem) {
        err.problem['@context'] = env.problemBase;
        err.problem.send(res);
      } else {
        var p = problem.raise({status:500,detail:err.message});
        p.problem['@context'] = env.problemBase;
        p.send(res);
      }
    });

    function extractContextLinks(req) {
      var link_header = req.get('link');
      if (link_header) {
        var parsed = linkparser(link_header);
        var context = parsed.context;
        if (context) {
          return url.resolve(req.fullURL, context.url);
        }
      }
    }

    function serialize(req, document, callback) {
      var store = as.createStore();
      for (var n = 0, l = document.triples.length; n < l; n++) {
        var triple = document.triples[n];
        store.addTriple(
          triple.subject, 
          triple.predicate, 
          triple.object);
      }
      as.importBase(store, req.fullURL).
         export(callback, extractContextLinks(req));
    }

    function get(req, res, includeBody) {
      res.set('Vary', 'Accept, Link');
      res.set('Cache-Control', 'no-cache'); // in real-world, we'll likely want to cache
      db.get(req.fullURL, function(err, document) {
        if (err) {
          reportServerError(res, env, 'Storage Error');
          return;
        }
        if (!document) {
          res.status(404).end();
          return;
        }
        if (document.deleted) {
          res.status(410).end();
          return;
        }
        utils.addHeaders(res, document);
        utils.insertCalculatedTriples(req, document, db, function(err, preferenceApplied) {
          if (err) {
            reportServerError(res, env, 'Processing Error');
            return;
          }
          serialize(req, document, function(err,exported) {
            if (err) {
              console.log(err.stack);
              reportServerError(res, env, 'Serialization Error');
              return;
            }
            if (!exported['@id']) 
              exported['@id'] = req.fullURL;
            var additional_context = extractContextLinks(req);
            if (additional_context) {
              exported['@context'] = [env.contextBase, additional_context];
            } else {
              exported['@context'] = env.contextBase;
            }
            var content = JSON.stringify(exported);
            var eTag = etag(content,{weak:true});
            if (req.get('If-None-Match') === eTag) {
              res.status(304).end();
              return;
            }
            if (preferenceApplied) {
              res.set('Preference-Applied', 'return=representation');
            }
            res.writeHead(200, {
              'ETag': eTag,
              'Content-Type': media.as
            });
            if (includeBody) {
              res.end(new Buffer(content), 'utf-8');
            } else {
              res.end();
            }
          }); // serialize
        }); // utils.insertCalculatedTriples
      });
    }

    resource.get(function(req, res, next) {
      get(req, res, true);
    });

    resource.head(function(req, res, next) {
      get(req, res, false);
    });

    resource.put(utils.rawBody.bind(env), function(req, res, next) {
      if (!req.is(media.as) && !req.is(media.jsonld)) {
        res.status(415).end();
        return;
      }
      var ifMatch = req.get('If-Match');
      if (!ifMatch) {
        res.status(428).end();
        return;
      }
      db.get(req.fullURL, function(err, doc) {
        if (utils.isContainer(doc)) {
          res.set('Allow', 'GET,HEAD,OPTIONS,POST').status(405).end();
          return;
        }
        if (err) {
          reportServerError(res, env, 'Storage Error');
          return;
        }
        if (!doc) {
          res.status(404).end();
        }
        if (doc.deleted) {
          res.status(410).end();
          return;
        }

        utils.insertCalculatedTriples(req, doc, db, function(err, preferenceApplied) {
          if (err) {
            console.log(err.stack);
            reportServerError(res, env, 'Processing Error');
            return;
          }
          serialize(req, doc, function(err,exported) {
            if (err) {
              console.log(err.stack);
              reportServerError(res, env, 'Serialization Error');
              return;
            }
            if (!exported['@id']) 
              exported['@id'] = req.fullURL;
            exported['@context'] = env.contextBase;
            var content = JSON.stringify(exported);
            var eTag = etag(content,{weak:true});

            if (ifMatch !== eTag) {
              res.status(412).end();
              return;
            }
            var parsed = JSON.parse(req.rawBody);
            if (parsed['@id'] !== req.fullURL) {
              res.status(409).end();
              return;
            }
            var now = new Date();
            parsed.updated = now.toISOString();
            as.import(parsed, function(err, imported) {
              if (err) {
                reportContentError(res, env, err.message || 'Unspecified Content Error');
                return;
              }
              var new_triples = imported._store.findByIRI();
              doc.triples = new_triples.map(sanitize);
              doc.timestamp = now.valueOf();
              db.put(req.fullURL, doc, function(err) {
                if (err) {
                  reportServerError(res, env, 'Storage Error');
                  return;
                }
                res.status(204).end();
              }); // db.put
            }); //as.import
          }); // serialize
        }); // utils.insertCalculatedTriples
      }); // db.get
    }); // resource.put

    resource.post(utils.rawBody, function(req, res, next) {
      db.findContainer(req.fullURL, function(err, container) {
        if (err) {
          console.log(err.stack);
          reportServerError(res, env, 'Storage Error');
          return;
        }
        if (!container) {
          res.set('Allow', 'GET,HEAD,PUT,DELETE,OPTIONS').status(405).end();
          return;
        }
        
        if (!req.is(media.as) && !req.is(media.jsonld)) {
          res.status(415).end();
          return;
        }

        utils.assignURI(db,req.fullURL, req.get('Slug'), function(err, loc) {
          if (err) {
            console.log(err.stack);
            reportServerError(res, env, 'Processing Error');
            return;
          }
          var parsed;
          try {
            parsed = JSON.parse(req.rawBody);
          } catch (err) {
            reportContentError(res, env, err.message || 'Unspecified Content Error');
            return;
          }
          var old_id = parsed['@id'];
          parsed['@id'] = loc.id; // override the existing @id
          var now = new Date();
          parsed.updated = now.toISOString();
          parsed.published = now.toISOString();
          as.import(parsed, function(err, imported) {
            if (err) {
              db.releaseURI(loc);
              reportContentError(res, env, err.message || 'Unspecified Content Error');
              return;
            }
            var document = {
              _id: loc.id,
              _rev: loc.rev,
              deleted: false,
              interactionModel: ldp.RDFSource,
              triples: imported._store.findByIRI().map(function(triple) {
                if (triple.subject === old_id) 
                  triple.subject = loc.id;
                if (triple.object === old_id)
                  triple.object = loc.id;
                return sanitize(triple);
              }),
              containedBy: req.fullURL,
              timestamp: now.valueOf()
            };
            db.put(loc.id, document, function(err) {
              if (err) {
                db.releaseURI(loc);
                reportServerError(res, env, 'Storage Error');
                return;
              }
              utils.addHeaders(res, document);
              res.set('Location', loc.id);
              res.status(201).end();
            }); // db.put
          }); // as.import
        }); // utils.assignURI
      }); // findContainer
    }); // resource.post

    resource.delete(function(req, res, next) {
      var ifMatch = req.get('If-Match');
      if (!ifMatch) {
        res.status(428).end();
        return;
      }
      db.get(req.fullURL, function(err, doc) {
        if (utils.isContainer(doc)) {
          res.set('Allow', 'GET,HEAD,OPTIONS,POST').status(405).end();
          return;
        }
        if (err) {
          reportServerError(res, env, 'Storage Error');
          return;
        }
        if (!doc) {
          res.status(404).end();
        }
        if (doc.deleted) {
          res.status(204).end();
          return;
        }

        utils.insertCalculatedTriples(req, doc, db, function(err, preferenceApplied) {
          if (err) {
            console.log(err.stack);
            reportServerError(res, env, 'Processing Error');
            return;
          }
          serialize(req, doc, function(err,exported) {
            if (err) {
              console.log(err.stack);
              reportServerError(res, env, 'Serialization Error');
              return;
            }
            if (!exported['@id']) 
              exported['@id'] = req.fullURL;
            exported['@context'] = env.contextBase;
            var content = JSON.stringify(exported);
            var eTag = etag(content,{weak:true});
            if (ifMatch !== eTag) {
              res.status(412).end();
              return;
            }
            doc.deleted = true;
            db.put(req.fullURL, doc, function(err) {
              if (err) {
                reportServerError(res, env, 'Storage Error');
                return;
              }
              res.status(204).end();
            }); // db.put
          }); // serialize
        }); // utils.insertCalculatedTriples
      }); // db.get
    }); // resource.delete

    resource.options(function(req, res, next) {
      db.get(req.fullURL, function(err, document) {
        if (err) {
          console.log(err.stack);
          reportServerError(res, env, 'Storage Error');
          return;
        }
        if (!document) {
          res.status(404).end();
          return;
        }
        if (document.deleted) {
          res.status(410).end();
          return;
        }
        utils.addHeaders(res, document);
        res.status(200).end();
      });
    });
  }

  // create root container if it doesn't exist
  db.get(env.ldpBase, function(err, document) {
    if (err || !document || document.deleted) {
      console.log('Creating root container');
      createRootContainer(
        env.ldpBase, db, function(err) {
        if (err) {
          console.log(err.stack);
        }
        keepGoing();
      });
    } else keepGoing();
  });

};