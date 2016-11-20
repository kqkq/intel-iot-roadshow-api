var express = require('express');
var bodyParser = require('body-parser');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');
var config = require('./config');
var sql = require('./sqlUtil')(config.db.database.v1);

var api = express.Router();
var jsonParser = bodyParser.json();

function sha256(str) {
  var sha = crypto.createHash('sha256');
  sha.update(str);
  return sha.digest('hex');
}

api.post('/', jsonParser, function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var json = {};

  sql.query('SELECT * FROM users WHERE username=\'' + username + '\' AND password=\'' + sha256(password) + '\'', function(err, rows) {
    if(err || rows.length != 1) {
      if(err) console.log(err);
      json.success = false;
      json.info = 'Authenthcation failed.'
      res.status(401).json(json);
    } else {
      var user_id = parseInt(rows[0].id);
      var token = jwt.sign({user: username, uid: user_id}, config.api.secret, config.api.options);
      sql.query('UPDATE users SET token=\'' + token + '\', last_login=\'' + sql.dateString() + '\' ' +
                'WHERE ID=' + user_id, function(err, info) {
        if(!err && info.affectedRows == 1) {
          json.success = true;
          json.token = token;
          res.status(200).json(json);
        } else {
          res.status(500).end();
          console.log(err);
        }//end if UPDATE token failed
      });//end UPDATE token query
    }//end IF successfully login
  });//end SELECT query
});//end of POST handler

module.exports = api;
