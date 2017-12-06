var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var pg = require('pg');
var async = require('async');
var nodemailer = require('nodemailer');

var VerifyToken = require(__root + '/routes/auth/VerifyToken');
var VerifyPermission = require('../auth/VerifyPermission')

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:southwestcorner@131.104.180.104:5432/nicktest';
pg.defaults.ssl = true;

var config = require('../../config');

//Endpoint to delete a User's acct by said User
router.delete('/accdel', VerifyToken, function(req, res, next) {
  const results = [];
  pg.connect(connectionString, function(err, client, done){
    if(err){
      done();
      console.log(err);
      return res.status(500).json({success: false, error: err});
    }
    var query = client.query("DELETE FROM USERS where email=($1);", [req.email]);
    query.on('error', (err)=>{
      console.log(err);
      res.status(500).json({success: false, error: err});
    });
    query.on('row', (row)=>{
      results.push(row);
    });
    query.on('end', () =>{
      done();
      res.status(200).json({authenticated: false, success: true, data: 'User succesfully deleted'});
    });
  });
});

function checkUndef(str) {
  return new Promise(function(accept, reject) {
    if (typeof str !== 'undefined') {
      accept(1)
    }
  })
}

//Endpoint to update User details
router.put('/update', VerifyToken, function(req, res, next) {
  const results = [];
  //Select * user then compare body to results. Update with data.fname || results.fname
  //Can add more booleans here for new fields
  pg.connect(connectionString, function(err, client, done){
    console.log();
    if(err){
      done();
      console.log(err);
      return res.status(500).json({success: false, error: err});
    }

    var fname = req.body.fname;
    console.log("fname: "+fname);
    var lname = req.body.lname;
    console.log("lname: "+lname);

    //Get the user with the email
    var query = client.query("select * from USERS where email=($1);", [req.email]);
    query.on('error', (err)=>{
      console.log(err);
      res.status(500).json({success: false, error: err});
    })
    query.on('row', (row)=>{
      results.push(row);
    })

    checkUndef(fname)
    .then(res => {
      //Query
      var query = {
        text: "update USERS set fname=($1) where email=($2);",
        values: [fname, req.email]
      }
      //Callback
      client.query(query, (err, result) => {
        if (err) {
          console.log("fname Callback fail "+err);
          res.status(500).json({success: false, error: err});
        } else {
          console.log("fname Callback success");
        }
      });
      //Promise
      client.query(query)
        .then(res => console.log("fname Promise Success "+res.rows[0]))
        .catch(e => console.error("fname Promise Fail "+e.stack))
    })
    .then(res => {
      done();
      res.status(200).json({authenticated: true, success: true, data: 'User info successfully updated'});
    })
    .catch(err => {
      console.log("fname checkUndef Error "+err)
  })

    checkUndef(lname)
      .then(res => {
        //Query
        var query = {
          text: "update USERS set lname=($1) where email=($2);",
          values: [lname, req.email]
        }
        //Callback
        client.query(query, (err, result) => {
          if (err) {
            console.log("lname Callback fail "+err);
            res.status(500).json({success: false, error: err});
          } else {
            console.log("lname Callback success");
          }
        });
        //Promise
        client.query(query)
          .then(res => console.log("lname Promise Success "+res.rows[0]))
          .catch(e => console.error("lname Promise Fail "+e.stack))
      })
      .then(res => {
        done();
        res.status(200).json({authenticated: true, success: true, data: 'User info successfully updated'});
      })
      .catch(err => {
        console.log("lname checkUndef Error "+err)
    })

    done();
    res.status(200).json({authenticated: true, success: true, data: 'User info successfully updated'});
  });
});

router.get('/allUsers', [VerifyToken, VerifyPermission('sw')], function(req,res,next){
  var results = [];
  pg.connect(connectionString, function (err, client, done){
    if (err) {
      done();
      console.log(err);
      return res.status(500).json({
        success: false,
        data: err
      });
    }
    var query = client.query('select * from users;');
    query.on('error', (err)=>{
      console.log(err);
      res.status(500).json({
        success: false,
        error: err
      });
    });
    query.on('row', (row) =>{
      results.push(row);
    });
    query.on('end', ()=>{
      var users = [];
      for(var result in results){
        var user = {};
        console.log(results[result]);
        user.email = results[result].email;
        user.fname = results[result].fname;
        user.lname = results[result].lname;
        user.picpath = results[result].picpath;
        users.push(user);
      }
      res.status(200).json(users);
    });
  });
});

router.get('/usersFor/:swemail', [VerifyToken, VerifyPermission('sw')], function(req, res, next){
  var results = [];
  pg.connect(connectionString, function(err, client, done){
    if (err) {
      done();
      console.log(err);
      return res.status(400).json({
        success: false,
        data: err
      });
    }
    var query = client.query('select u.email, u.fname, u.lname from supportrelation sr, users u where sr.supportemail=($1) and sr.clientemail=u.email;', [req.params.swemail]);
    query.on('error', (err)=>{
      console.log(err);
      res.status(400).json({success: false, error: err});
    });
    query.on('row', (row) =>{
      results.push(row);
    });
    query.on('end', ()=>{
      res.status(200).json({success: true, userData: results});
    });
  });
});

router.post('/assignUser', [VerifyToken, VerifyPermission('sw')], function(req, res, next){
  var results = [];
  var clcUser = req.body.clcUser;
  //set the sw to be assigned to based on the request, or if not included assume it will be assigned to the sw making the request
  var sw = req.body.sw || req.email;
  pg.connect(connectionString, function(err, client, done){
    if (err) {
      done();
      console.log(err);
      return res.status(400).json({
        success: false,
        data: err
      });
    }
    var query = client.query('insert into supportrelation (clientemail, supportemail) values (($1), ($2));', [clcUser, sw]);
    query.on('error', (err) =>{
      console.log(err);
      res.status(400).json({success: false, error: err});
    });
    query.on('row', (row) =>{
      results.push(row);
    });
    query.on('end', () =>{
      res.status(201).json({success:true});
    });

  });
});


//MEDICATION STREAK DATA

module.exports = router;
