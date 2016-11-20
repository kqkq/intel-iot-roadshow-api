var express = require('express');
var sessions = require('./sessions');
var devices = require('./devices');

var api = express.Router();

api.use('/sessions', sessions);
api.use('/devices', devices);

module.exports = api;
