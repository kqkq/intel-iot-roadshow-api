var express = require('express');
var api = express.Router();

api.get('/.well-known/acme-challenge/:key', function(req, res) {
  res.sendFile(__dirname + '/.well-known/acme-challenge/' + req.params.key, function(err) {
    if(err) {
      console.log(err);
      res.status(err.status).end('Not Found');
    } else {
      console.log('Sending: ' + __dirname + '/.well-known/acme-challenge/' + req.params.key);
    }
  });
});

api.get('/favicon.ico', function(req, res) {
  console.log('Sending: ' + __dirname + '/favicon.ico');
  res.sendFile(__dirname + '/favicon.ico');
});

api.get(function(req, res) {
  res.status(404);
  res.send('Not found.');
});

module.exports = api;
