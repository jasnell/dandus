{
  "_id": "_design/search",
  "_rev": "23-e01e02711c63da0e264caad34f1e6b56",
  "views": {},
  "language": "javascript",
  "indexes": {
    "containment": {
      "analyzer": "whitespace",
      "index": "function(doc){\n index(\"containedBy\", doc.containedBy, {store:true});\n index(\"deleted\", doc.deleted);\n index(\"timestamp\", doc.timestamp, {store:true});\n \n var as = 'http://www.w3.org/ns/activitystreams#';\n if (!doc.deleted) {\n   var root_id = doc._id;\n   var loc_id;\n   var cache = {};\n   index(\"timestamp\", doc.timestamp);\n   doc.triples.forEach(function(triple) {\n     cache[triple.subject] = cache[triple.subject] || {};\n     cache[triple.subject][triple.predicate] = cache[triple.subject][triple.predicate] || [];\n     cache[triple.subject][triple.predicate].push(triple.object);\n     if (triple.subject == root_id && \n         triple.predicate == as+'location') {\n        loc_id = triple.object;\n     }\n     if (triple.subject == root_id &&\n         triple.predicate == as+'actor') {\n       index('actor', triple.object, {store:true});      \n     }\n     if (triple.subject == root_id && \n         triple.predicate == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {\n       index('type', triple.object, {store:true});\n     }\n   });\n   if (loc_id && cache[loc_id]) {\n     var loc = cache[loc_id];\n     ['longitude', 'latitude'].\n       forEach(function(key) {\n         if (loc[as + key]) {\n           index(key, loc[as + key][0], {store:true});\n         }\n       });\n   }\n }\n \n}"
    },
    "find": {
      "analyzer": "whitespace",
      "index": "function(doc){\n var as = 'http://www.w3.org/ns/activitystreams#';\n if (!doc.deleted) {\n   var root_id = doc._id;\n   var loc_id;\n   var cache = {};\n   index(\"timestamp\", doc.timestamp);\n   doc.triples.forEach(function(triple) {\n     cache[triple.subject] = cache[triple.subject] || {};\n     cache[triple.subject][triple.predicate] = cache[triple.subject][triple.predicate] || [];\n     cache[triple.subject][triple.predicate].push(triple.object);\n     if (triple.predicate == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {\n       index(\"type\", triple.object, {store:true});\n     } else if (triple.subject == root_id && \n                triple.predicate == as+'location') {\n        loc_id = triple.object;\n     }\n   });\n   if (loc_id && cache[loc_id]) {\n     var loc = cache[loc_id];\n     ['longitude', 'latitude', 'altitude', 'radius', 'accuracy', 'units'].\n       forEach(function(key) {\n         if (loc[as + key]) {\n           index(key, loc[as + key][0], {store:true});\n         }\n       });\n   }\n }\n}"
    },
    "byactor": {
      "analyzer": "whitespace",
      "index": "function(doc){\n var triples = doc.triples;\n for (var n = 0, l = triples.length; n < l; n++) {\n   var triple = triples[n];\n   if (triple.predicate === 'http://www.w3.org/ns/activitystreams#actor') {\n     index('actor',triple.object, {store:true});\n   }\n }\n}"
    }
  }
}