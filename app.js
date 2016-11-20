var app = require('express')();
var server = require('http').Server(app);
var io = require('./socket');
var morgan = require('morgan');
var guestbook = require('./guestbook');
var v1 = require('./v1-router');
var config = require('./config');

app.use(morgan('dev'));
app.use('/v0', guestbook);
app.use('/v1', v1);

io.open(server);

server.listen(config.server.port, function() {
  console.log('Web service started!');
});
