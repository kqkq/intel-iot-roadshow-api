var express = require('express');
var auth = require('basic-auth');
var bodyParser = require('body-parser');
var jwt = require('jsonwebtoken');
var config = require('./config');
var sql = require('./sqlUtil')(config.db.database.v1);
var socket = require('./socket');

var api = express.Router();
var jsonParser = bodyParser.json();

// Query for all devices of a user
api.get('/', function(req, res) {
  var token = (auth(req) ? auth(req).pass : undefined);
  jwt.verify(token, config.api.secret, config.api.options, function(err, decoded) {
    if(err) {
      res.status(401).json({success: false, info: 'Invalid token'});
    } else {
      sql.query('SELECT * FROM devices JOIN binding ON binding.udid=devices.udid AND binding.uid=' + decoded.uid, function(err, rows) {
        if(err) {
          console.log(err);
          res.status(500).json({success: false, info: 'Internal error'});
        } else {
          var json = {};
          for(var idx in rows) {
            var row = rows[idx];
            json[row.udid] = {};
            json[row.udid].online = row.socket_id ? true : false;
            json[row.udid].udid = row.udid;
            json[row.udid].name = row.name;
            json[row.udid].is_owner = row.owner == 0 ? false : true;
            json[row.udid].is_user = row.user == 0 ? false : true;
            if(json[row.udid].online) {
              json[row.udid].locked = row.locked == 0 ? false : true;
              json[row.udid].opened = row.opened == 0 ? false : true;
            }
          }
          console.log(JSON.stringify(rows));
          res.status(200).json(json);
        }
      });
    }
  });
});

// Query the status of a single device
api.get('/:udid', function(req, res) {
  var token = (auth(req) ? auth(req).pass : undefined);
  var udid = req.params.udid;
  jwt.verify(token, config.api.secret, config.api.options, function(err, decoded) {
    if(err) {
      res.status(401).json({success: false, info: 'Invalid token'});
    } else {
      sql.query('SELECT * FROM devices LEFT JOIN binding ON binding.udid=devices.udid AND binding.uid=' + decoded.uid + ' WHERE devices.udid=\'' + udid + '\'', function(err, rows) {
        if(err || rows.length > 1) {
          console.log(err);
          res.status(500).json({success: false, info: 'Internal error'});
        }
        else if(rows.length == 0) {
          res.status(404).json({success: false, info: 'Device not found'});
        }
        else if(rows[0].user != 1) {
          res.status(403).json({success: false, info: 'Permission denied'});
        } else {
          var json = {};
          json.online = rows[0].socket_id ? true : false;
          json.udid = rows[0].udid;
          json.name = rows[0].name;
          json.is_owner = rows[0].owner == 0 ? false : true;
          json.is_user = rows[0].user == 0 ? false : true;
          if(json.online) {
            json.locked = rows[0].locked == 0 ? false : true;
            json.opened = rows[0].opened == 0 ? false : true;
          }
          //console.log(JSON.stringify(rows));
          res.status(200).json(json);
        }
      });
    }
  });
});//end GET devices

// Bind a device to current user
api.put('/:udid', jsonParser, function(req, res) {
  var token = (auth(req) ? auth(req).pass : undefined);
  var udid = req.params.udid;
  var vcode = req.body.vcode;
  jwt.verify(token, config.api.secret, config.api.options, function(err, decoded) {
    if(err) {
      res.status(401).json({success: false, info: 'Invalid token'});
    } else {
      sql.query('SELECT * FROM devices LEFT JOIN binding ON devices.udid = binding.udid WHERE devices.udid = \'' + udid + '\'', function(err, rows) {
        if(err || rows.length > 1) {
          res.status(500).json({success: false, info: 'Internal error'});
        }
        else if(rows.length == 0) {
          res.status(404).json({success: false, info: 'Device not found'});
        }
        else if(!rows[0].socket_id) {
          res.status(503).json({success: false, info: 'Device offline'});
        }
        else if(rows[0].uid && rows[0].uid == decoded.uid) {
          res.status(200).json({success: true, info: 'Device was bound to you'});
        }
        else if(rows[0].uid && rows[0].uid != decoded.uid) {
          res.status(403).json({success: false, info: 'Device is not bindable'});
        }
        else if(vcode && rows[0].vcode != vcode) {
          res.status(403).json({success: false, info: 'Verification code is invalid'});
        }
        else if(vcode && rows[0].vcode == vcode) {
          sql.query('INSERT INTO binding (uid, udid, owner, user) VALUES (\'' + decoded.uid + '\', \'' + udid + '\', true, true)', function(err, info) {
            if(err || info.affectedRows != 1) {
              res.status(500).json({success: false, info: 'Internal error'});
              if(err) console.log(err);
            } else {
              res.status(200).json({success: true, info: 'Binding successful'});
            }
          });//end of INSERTing binding
        }
        else if(!vcode) {
          var rand = Math.floor(Math.random() * 0 + 100000);
          socket.sendVcode(rows[0].socket_id, rand, function(err) {
            if(err) {
              res.status(500).json({success: false, info: 'Internal error'});
              console.log(err);
            } else {
              sql.query('UPDATE devices SET vcode=' + rand + ' WHERE udid=\'' + udid + '\'', function(err, info) {
                if(err || info.affectedRows != 1) {
                  res.status(500).json({success: false, info: 'Internal error'});
                  if(err) console.log(err);
                } else {
                  res.status(200).json({success: true, info: 'Verification code sent'});
                }
              });
            }
          });//end of sending verification code
        }
        else {
          res.status(500).end();
          console.log('Never comes here.');
        }
      }); //end of SELECT query
    } //end of token valid
  }); //end token verify
}); //end if PUT device

// Lock a device
api.lock('/:udid', function(req, res) {
  var token = (auth(req) ? auth(req).pass : undefined);
  var udid = req.params.udid;
  jwt.verify(token, config.api.secret, config.api.options, function(err, decoded) {
    if(err) {
      res.status(401).json({success: false, info: 'Invalid token'});
    } else {
      sql.query('SELECT * FROM devices LEFT JOIN binding ON binding.udid=devices.udid AND binding.user=true AND binding.uid=' + decoded.uid + ' WHERE devices.udid=\'' + udid + '\'', function(err, rows) {
        if(err || rows.length > 1) {
          console.log(err);
          res.status(500).json({success: false, info: 'Internal error'});
        }
        else if(rows.length == 0) {
          res.status(404).json({success: false, info: 'Device not found'});
        }
        else if(rows[0].user != 1) {
          res.status(403).json({success: false, info: 'Permission denied'});
        }
        else if(!rows[0].socket_id) {
          res.status(503).json({success: false, info: 'Device offline'});
        } else {
          socket.sendLock(rows[0].socket_id, true, function() {
            sql.query('UPDATE devices SET locked = true WHERE udid = \'' + udid + '\'', function() {
              res.status(200).json({success: true, info: 'Lock successful'});
            });
          });
        }
      });
    }
  });
});

// Unlock a device
api.unlock('/:udid', function(req, res) {
  var token = (auth(req) ? auth(req).pass : undefined);
  var udid = req.params.udid;
  jwt.verify(token, config.api.secret, config.api.options, function(err, decoded) {
    if(err) {
      res.status(401).json({success: false, info: 'Invalid token'});
    } else {
      sql.query('SELECT * FROM devices LEFT JOIN binding ON binding.udid=devices.udid AND binding.user=true AND binding.uid=' + decoded.uid + ' WHERE devices.udid=\'' + udid + '\'', function(err, rows) {
        if(err || rows.length > 1) {
          console.log(err);
          res.status(500).json({success: false, info: 'Internal error'});
        }
        else if(rows.length == 0) {
          res.status(404).json({success: false, info: 'Device not found'});
        }
        else if(rows[0].user != 1) {
          res.status(403).json({success: false, info: 'Permission denied'});
        }
        else if(!rows[0].socket_id) {
          res.status(503).json({success: false, info: 'Device offline'});
        } else {
          socket.sendLock(rows[0].socket_id, false, function(err) {
            if(err) {
              console.log(err);
              res.status(500).json({success:false, info: 'Internal error - socket.io'});
            } else {
              sql.query('UPDATE devices SET locked = false WHERE udid = \'' + udid + '\'', function() {
                res.status(200).json({success: true, info: 'Unlock successful'});
              });
            }
          });
        }
      });
    }
  });
});

// Unbind a device
api.delete('/:udid', function(req, res) {
  var token = (auth(req) ? auth(req).pass : undefined);
  var udid = req.params.udid;
  jwt.verify(token, config.api.secret, config.api.options, function(err, decoded) {
    if(err) {
      res.status(401).json({success: false, info: 'Invalid token'});
    } else {
      sql.query('SELECT * FROM devices LEFT JOIN binding ON binding.udid=devices.udid AND binding.uid=' + decoded.uid + ' WHERE devices.udid=\'' + udid + '\'', function(err, rows) {
        if(err || rows.length > 1) {
          console.log(err);
          res.status(500).json({success: false, info: 'Internal error'});
        }
        else if(rows.length == 0) {
          res.status(404).json({success: false, info: 'Device not found'});
        }
        else if(rows[0].user != 1 && rows[0].owner != 1) {
          res.status(403).json({success: false, info: 'Permission denied'});
        } else {
          sql.query('DELETE FROM binding WHERE udid = \'' + udid + '\' AND uid = ' + decoded.uid, function() {
            res.status(200).json({success: true, info: 'Unbind successful'});
          });
        }
      });
    }
  });
});

module.exports = api;
