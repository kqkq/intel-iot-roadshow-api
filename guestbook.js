var express = require('express');
var bodyParser = require('body-parser');
var config = require('./config');
var sql = require('./sqlUtil')(config.db.database.v0);
//var sql = nedb('guestbook');

var api = express.Router();

//mongoose.Promise = global.Promise;

//var msgSchema = new mongoose.Schema({date: Date, message: String});
//var Message = mongoose.model('Message', msgSchema, 'messages');
var jsonParser = bodyParser.json();

//mongoose.connect('mongodb://localhost/guestbook').connection
//.on('error', console.error.bind(console, 'connection error:'))
//.once('open', function() {
//  console.log('Mongoose connected to the DB.');
//});

api.get('/messages', function(req, res) {
  //Message.find().sort({date: -1}).exec(function(err, docs) {
  //  console.log(docs.length + ' records requested.');
  //  res.json(docs);
  //});
  sql.query('SELECT * FROM messages ORDER BY id DESC', function(err, rows) {
    console.log(rows.length + ' records requested.');
    if(err) console.log(err);
    res.json(rows);
  });
});

api.post('/messages', jsonParser, function(req, res) {
  var dt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  //msg.save(function(err) {
  //  console.log('1 record inserted.');
  //  res.json({result: 1});
  //});
  sql.query('INSERT INTO messages (mdate, message) VALUES (\'' + dt + '\', \'' + req.body.msg + '\')', function(err, info) {

    if(err) console.log(err);
    res.json({result: info.affectedRows});
  });
});

module.exports = api;
