var config = require('./config');
var sql = require('./sqlUtil')(config.db.database.v1);
var sio = require('socket.io');
var io;
var clients;

module.exports.open = function(server) {
  sql.query('UPDATE devices SET socket_id=NULL, vcode=NULL, opened=NULL WHERE socket_id IS NOT NULL OR vcode IS NOT NULL OR opened IS NOT NULL', function(err, info) {
    if(err) console.log(err);
    if(info && info.affectedRows != 0) console.log(info.affectedRows + ' records cleared!');
    io = sio(server);
    clients = io.of('/').connected;
    io.on('connection', connect);
  });
};

module.exports.clients = clients;
module.exports.sendVcode = function(socket_id, rand, callback) {
  var socket = clients[socket_id];
  if(!this.isOnline(socket_id)) {
    callback({info: 'Device offline'})
  } else {
    socket.emit('verify', {vcode: rand}, function(code_back) {
      if(code_back == rand) {
        callback();
      } else {
        callback({info: 'Failed to sent verification code'});
      }
    });
  } //end IS ONLINE
};

module.exports.sendLock = function(socket_id, lock, callback) {
  var socket = clients[socket_id];
  if(!this.isOnline(socket_id)) {
    if(callback) callback({info: 'Device offline'})
  } else {
    console.log('lock is ' + lock.toString());
    socket.emit(lock ? 'lock' : 'unlock', {}, function() {
      if(callback) callback();
    });
  } //end IS ONLINE
}

module.exports.ready = function(udid, callback) {
  sql.query('SELECT * FROM devices WHERE udid=\'' + udid + '\' AND socket_id IS NOT NULL', function(err, rows) {
    if(err || rows.length != 1 || !rows[0].socket || !clients[rows[0].socket]) {
      if(callback) callback(503, {success: false, info: 'Device offline'});
    } else {
      var socket = clients[rows[0].socket];
      socket.emit('ready', {}, function() {
        if(callback) callback(200, {success: true, info: 'Device ready'});
      });
    }
  });
};

module.exports.isOnline = function(socket_id) {
  console.log('Checking socket: ' + socket_id);
  if(socket_id) {
    return !(clients[socket_id] === undefined);
  } else {
    return false;
  }
};

function connect(socket) {
  socket.on('auth', function(data, callback) {
    sql.query('SELECT * FROM devices WHERE udid = \'' + data.udid + '\' AND secret = \'' + data.secret + '\'', function(err, rows) {
      if(!err && rows.length == 1) {
        sql.query('UPDATE devices SET socket_id = \'' + socket.id + '\' WHERE udid=\'' + data.udid + '\'', function(err, info) {
          if(err || info.affectedRows != 1) {
            //TODO: What will happen if socket id in db is NOT NULL? Current: Overwrite.
            if(err) console.log(err);
            socket.disconnect(true);
          } else {
            if(callback) callback({socket_id: socket.id});
            console.log('Device connected, UDID=' + data.udid + ' SocketID=' + socket.id);
          }
        });
      } else {
        if(err) console.log(err);
        socket.disconnect(true);
      }
    });
  });
  socket.on('disconnect', function() {
    sql.query('UPDATE devices SET socket_id = NULL, vcode=NULL, opened=NULL WHERE socket_id=\'' + socket.id + '\'', function(err, info) {
      if(err || info.affectedRows != 1) {
        //TODO: What will happen if socket id in db is NULL? Current: Ignore.
        if(err) console.log(err);
      } else {
        console.log('Device disconnected, SocketID=' + socket.id);
      }
    });
  });
  socket.on('status', function(status, callback) {
    console.log('Update status: ' + JSON.stringify(status));
    sql.query('UPDATE devices SET opened = ' + status.opened + ', locked = ' + status.locked + ' WHERE udid = \'' + status.udid + '\' AND socket_id=\'' + status.socket_id + '\'', function(err, info) {
      if(err || info.affectedRows != 1) {
        if(err) console.log(err);
        if(callback) callback({success: false});
      } else {
        if(callback) callback({success: true});
      }
    });
  });
}
