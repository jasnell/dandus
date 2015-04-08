'use strict';

var sanitize = require('sanitize-html');
var vocabs   = require('activitystrea.ms').vocabs;
var url      = require('url');
var n3util   = require('n3').Util;
var ldp      = require('./ldp');
var media    = require('./media');
var env      = require('../config/env');

// Removes all markup
exports.removeMarkup = function (text) {
  var val = n3util.getLiteralValue(text),
      type = n3util.getLiteralType(text),  
      ret = '"' + sanitize(val, {allowedTags:[]}) + '"';
  if (type) {
    ret += '^^' + type;
  }
  return ret;
};

exports.sanitizeUsingPolicy = function(text, options) {
  var val = n3util.getLiteralValue(text),
      type = n3util.getLiteralType(text),
      ret = '"' + sanitize(val,options) + '"';
  if (type) {
    ret += '^^' + type;
  }
  return ret;
};

exports.sanitize = function(triple) {
  var policy = this.sanitize;
  if (policy) {
    if (policy.plaintext && policy.plaintext[triple.predicate]) {
      triple.object = exports.removeMarkup(triple.object);
    }
    else if (policy.markup && policy.markup[triple.predicate]) {
      if (policy.options) {
        triple.object = exports.sanitizeUsingPolicy(triple.object, policy.options);
      }
      else {
        triple.object = exports.sanitizeUsingPolicy(triple.object);
      }
    }
  }
  return triple;
};

exports.check_types = function(types, target) {
  for (var n = 0; n < types.length; n++) {
    if (target.indexOf(types[n]) > -1)
      return true;
  }
  return false;
};

exports.ensureAuthenticated = function(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/auth');
};

exports.addHeaders = function (res, document, readonly) {
  var allow = 'GET,HEAD,OPTIONS';
  if (!readonly)
    allow += ',DELETE';
  if (exports.isContainer(document)) {
    res.links({type: vocabs.as.Collection});
    if (!readonly) {
      allow += ',POST';
      res.set('Accept-Post', media.as);
    }
  } else {
    if (!readonly)
      allow += ',PUT';
  }

  res.set('Allow', allow);
};

exports.isContainer = function(document) {
  return document.interactionModel === ldp.BasicContainer;
};

function hasPreferInclude(req, inclusion) {
  return hasPrefer(req, 'include', inclusion);
}

function hasPreferOmit(req, omission) {
  return hasPrefer(req, 'omit', omission);
}

function hasPrefer(req, token, parameter) {
  if (!req) {
    return false;
  }

  var preferHeader = req.get('Prefer');
  if (!preferHeader) {
    return false;
  }

  // from the LDP prefer parameters, the only charcter we need to escape
  // for regular expressions is '.'
  // https://dvcs.w3.org/hg/ldpwg/raw-file/default/ldp.html#prefer-parameters
  var word = parameter.replace(/\./g, '\\.');

  // construct a regex that matches the preference
  var regex =
      new RegExp(token + '\\s*=\\s*("\\s*([^"]+\\s+)*' + word + '(\\s+[^"]+)*\\s*"|' + word + '$)');
  return regex.test(preferHeader);
}

// determine if this is a membership resource.  if it is, insert the
// membership triples.
function insertMembership(req, document, callback) {
  callback(null, false);
}

exports.insertCalculatedTriples = function(req, document, db, callback) {
  // insert membership if this is a membership resource
  insertMembership(req, document, function(err, preferenceApplied) {
    if (err) {
      callback(err);
      return;
    }

    // next insert any dynamic triples if this is a container
    if (!exports.isContainer(document)) {
      callback(null, preferenceApplied);
      return;
    }

    // check if client is asking for a minimal container
    var minimal = false;
    if (hasPreferInclude(req, ldp.PreferMinimalContainer) ||
        hasPreferInclude(req, ldp.PreferEmptyContainer)) {
      preferenceApplied = true;
      minimal = true;
    }

    // include containment?
    var includeContainment;
    if (hasPreferInclude(req, ldp.PreferContainment)) {
      includeContainment = true;
      preferenceApplied = true;
    } else if (hasPreferOmit(req, ldp.PreferContainment)) {
      includeContainment = false;
      preferenceApplied = true;
    } else {
      includeContainment = !minimal;
    }

    // include membership?
    var includeMembership;
    if (document.interactionModel === ldp.DirectContainer && document.hasMemberRelation) {
      if (hasPreferInclude(req, ldp.PreferMembership)) {
        includeMembership = true;
        preferenceApplied = true;
      } else if (hasPreferOmit(req, ldp.PreferMembership)) {
        includeMembership = false;
        preferenceApplied = true;
      } else {
        includeMembership = !minimal;
      }
    } else {
      includeMembership = false;
    }

    if (!includeContainment && !includeMembership) {
      // we're done!
      callback(null, preferenceApplied);
      return;
    }

    db.getPagedContainment(document._id, req.query, 
      function(err, containment, options) {
      var bookmark = options.bookmark;
      var totalItems = options.total_rows;
      var limit = options.limit; 
      var since = options.since;
      var fence = options.fence;
      var actor = options.actor;
      var type = options.type;
      if (err) {
        callback(err);
        return;
      }

      if (containment) {

        if (includeContainment) {
          document.triples.push({
            subject: document._id,
            predicate: vocabs.as.itemsPerPage,
            object: '"'+Math.min(containment.length, limit)+'"^^' + vocabs.xsd.nonNegativeInteger
          });
          document.triples.push({
            subject: document._id,
            predicate: vocabs.as.totalItems,
            object: '"'+totalItems+'"^^' + vocabs.xsd.nonNegativeInteger
          });
          var _link = url.parse(document._id);
          _link.query = {limit: limit};
          if (since) _link.query.since = since;
          if (fence) _link.query.fence = fence;
          if (actor) _link.query.actor = actor;
          if (type) _link.query.type = type;
          document.triples.push({
            subject: document._id,
            predicate: vocabs.as.first,
            object: url.format(_link)
          });
          if (containment.length == limit && bookmark) {
            _link.query.bookmark = bookmark;
            document.triples.push({
              subject: document._id,
              predicate: vocabs.as.next,
              object: url.format(_link)
            });
          }
        }

        var _b = process.hrtime();
        var blankpfx = '_:' + (_b[0] * 1e9 + _b[1]) + '-', 
            blankctr = 0;
        var _blank = function(map, id) {
          return map[id] || (map[id] = blankpfx + blankctr++);
        };

        // builds the ordered list of entries for the collection
        // because of the way lists work in RDF and JSON-LD, this
        // is a bit convoluted. We need to create n rdf:List structure,
        // for every item in the containment. So as:items is set to a 
        // list, which has first and rest properties, each node is a 
        // list whose first property points to the actual contained
        // resource.
        if (containment.length > 0) { 
          var list_blanks = {}, list_ctr = 0;
          var current_id = _blank(list_blanks,list_ctr++);
          // first, create the top level list item
          document.triples.push({
            subject: document._id,
            predicate: vocabs.as.items,
            object: current_id
          });
          // then start iterating through the actual list items

          var ii = function (triple) {
            if (n3util.isBlank(triple.subject)) {
              triple.subject = _blank(this, triple.subject);
            }
            if (n3util.isBlank(triple.object)) {
              triple.object = _blank(this, triple.object);
            }
            document.triples.push(triple);
          };

          for (var n = 0, l = containment.length; n < l; n++) {
            var resource = containment[n];
            // next id in the list is either a new blank id or rdf:nil
            var next_id = (n < l-1) ? _blank(list_blanks,list_ctr++) : vocabs.rdf.nil;
            document.triples.push({
              subject: current_id,
              predicate: vocabs.rdf.first,
              object: resource.id
            });
            document.triples.push({
              subject: current_id,
              predicate: vocabs.rdf.rest,
              object: next_id,
            });
            current_id = next_id;
            // import this items triples
            if (resource.triples) {
              var blankmap = {};
              resource.triples.forEach(ii.bind(blankmap));
            }

          }
        }
      }

      callback(null, preferenceApplied);
    });
  });
};

function addPath(uri, path) {
  uri = uri.split('?')[0].split('#')[0];
  if (uri.substr(-1) !== '/') {
    uri += '/';
  }
  // remove special characters from the string (e.g., '/', '..', '?')
  var lastSegment = path.replace(/[^\w\s\-_]/gi, '');
  return uri + encodeURIComponent(lastSegment);
}

function uniqueURI(db, container, callback) {
  var candidate = addPath(container, 'res' + Date.now());
  db.reserveURI(candidate, function(err, rev) {
    callback(err, rev);
  });
}

exports.assignURI = function(db, container, slug, callback) {
  if (slug) {
    var candidate = addPath(container, slug);
    db.reserveURI(candidate, function(err,rev) {
      if (err) {
        uniqueURI(db, container, callback);
      } else {
        callback(null, rev);
      }
    });
  } else {
    uniqueURI(db, container, callback);
  }
};

exports.rawBody = function(req,res,next) {
  // assumes bound to env
  var maxcontentlength = env.maxcontentlength || 0;
  var err;
  req.rawBody = ''; 
  req.setEncoding('utf8');
  req.on('data', function(chunk) {
    req.rawBody += chunk;
    if (maxcontentlength > 0 && req.rawBody.length > maxcontentlength) {
      res.status(413).end();
      err = true;
    }
  });
  req.on('end', function() {
    if (!err) next();
  });
};

function pageLink(base, options) {
  var parsed = url.parse(base, true);
  delete parsed.search;
  if (options.limit) {
    parsed.query.limit = parseInt(options.limit);
  }
  else {
    delete parsed.query.limit;
  }
  if (options.pageToken) {
    parsed.query.pageToken = options.pageToken;
  }
  else {
    delete parsed.query.pageToken;
  }
  return url.format(parsed);
}

exports.insertPageLinks = function(model, fullUrl, options, callback) {
  process.nextTick(function() {
    try {
      var base = fullUrl;
      var page = {};
      if (options.limit) page.limit = options.limit;
      model.current = pageLink(base, page);
      model.self = base;
      if (options.pageToken) {
        page.pageToken = options.pageToken;
        model.next = pageLink(base, page);
      }
      callback(null, model);
    } catch (err) {
      callback(err);
    }
  });
};