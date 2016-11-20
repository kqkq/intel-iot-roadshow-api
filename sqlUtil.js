var mysql = require('mysql');
var config = require('./config');

var pool = {};

function sqlUtil(database) {
  if(!(this instanceof sqlUtil)) return new sqlUtil(database);
  this.db = database;
  if(!pool[this.db]) {
    pool[this.db]= mysql.createPool({
      connectionLimit: config.db.connectionLimit,
      host: config.db.hostname,
      user: config.db.username,
      password: config.db.password,
      database: this.db,
      debug: config.db.debug
    });
    console.log('Creating connection pool for database: ' + this.db);
  }
}

sqlUtil.prototype.query = function(sql, callback) {
  pool[this.db].getConnection(function(err, conn) {
    if(err) {
      if(callback) callback(err);
      return;
    }
    conn.query(sql, function(err, rows, cols) {
      conn.release();
      if(!err) {
        if(callback) callback(err, rows, cols);
      } else {
        if(callback) callback(err);
      }
    });
  });
}

sqlUtil.prototype.dateString = function(date) {
  if(date === undefined) date = new Date();
  var locale = date.getTime() + (config.server.timezone * 60 * 60 * 1000);
  date = new Date(locale);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = sqlUtil;
