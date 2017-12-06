var express = require('express');
var router = express.Router();
var pg = require('pg');
var request = require('superagent');
var jwksRsa = require('jwks-rsa');
var jwt = require('express-jwt');

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:southwestcorner@131.104.180.104:5432/nicktest';
pg.defaults.ssl = true;
/* GET home page. */


module.exports = router;
