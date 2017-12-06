var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var pg = require('pg');
var VerifyToken = require('./VerifyToken');
var VerifyPermission = require('./VerifyPermission');
var crypto = require('crypto');
var async = require('async');
var nodemailer = require('nodemailer');

router.use(bodyParser.urlencoded({
  extended: false
}));
router.use(bodyParser.json());
// var User = require('../user/User');
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:southwestcorner@131.104.180.104:5432/nicktest';
pg.defaults.ssl = true;
/**
 * Configure JWT
 */
var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var bcrypt = require('bcryptjs');
var config = require('../../config'); // get config file

router.post('/login', function (req, res) {
  var authPassword = req.body.password;
  var authEmail = req.body.email;
  var results = [];
  pg.connect(connectionString, (err, client, done) => {
    // Handle connection errors
    if (err) {
      done();
      console.log(err);
      return res.status(500).json({
        success: false,
        data: err
      });
    }
    var query = client.query("select * FROM USERS where email=($1);", [authEmail]);
    query.on('row', (row) => {
      results.push(row);
    });

    // After all data is returned, close connection and return results
    query.on('end', () => {
      done();
      if (results.length != 1) {
        return res.status(401).json({
          success: false,
          message: 'Username does not exist',
          res: results
        });
      }
      // console.log(results);
      var result = results[0];
      var passwordIsValid = bcrypt.compareSync(authPassword, result.password);
      if (result.email === authEmail && passwordIsValid) {
        results = [];
        var query = client.query("SELECT * FROM admin where email=($1)", [authEmail]);
        query.on('row', (row) => {
          results.push(row);
        })
        query.on('end', () => {
          if (results.length == 1) {
            var token = jwt.sign({
              email: result.email,
              scope: "admin"
            }, config.secret, {
              expiresIn: 86400 // expires in 24 hours
            });
            res.status(200).send({
              auth: true,
              scope: "admin",
              token: token
            });
          } else {
            var query = client.query("SELECT * FROM supportworker where supportemail=($1)", [authEmail]);
            // var query = client.query("SELECT * FROM admin where email=($1)", [authEmail]);
            query.on('row', (row) => {
              results.push(row);
            })
            query.on('end', () => {
              if (results.length == 1) {
                var token = jwt.sign({
                  email: result.email,
                  scope: "sw"
                }, config.secret, {
                  expiresIn: 86400 // expires in 24 hours
                });
                res.status(200).send({
                  auth: true,
                  scope: "sw",
                  token: token
                });
              } else {
                var token = jwt.sign({
                  email: result.email,
                  scope: "user"
                }, config.secret, {
                  expiresIn: 86400 // expires in 24 hours
                });
                res.status(200).send({
                  auth: true,
                  scope: "user",
                  token: token
                });
              }
            })
          }
          // return the information including token as JSON
        });
      } else {
        return res.status(401).json({
          success: false,
          message: "incorrect password"
        })
      }
    });
  });
});

router.put('/regId', VerifyToken, function(req,res){
  var email = req.email;
  var regId = req.body.regId;
  pg.connect(connectionString, function(err, client, done){
    if (err) {
      done();
      console.log(err);
      return res.status(500).json({
        success: false,
        data: err
      });
    }
    if(typeof regId === 'undefined'){
      res.status(400).json({
        success:false,
        message: "Missing Registration ID"
      });
    }
    var query = client.query('update users set regid=($1) where email=($2)',[regId, email]);
    query.on('error', (err)=>{
      console.log(error);
      res.status(500).json({success:false, error: err});
    });
    query.on('end', ()=>{
      res.status(201).json({success: true});
    })
  });
});

router.get('/logout', function (req, res) {
  res.status(200).send({
    auth: false,
    token: null
  });
});


router.post('/register', function (req, res) {
  var hashedPassword = bcrypt.hashSync(req.body.password, 8);
  pg.connect(connectionString, function (err, client, done) {
    if (err) {
      done();
      console.log(err);
      return res.status(500).json({
        success: false,
        data: err
      });
    }

    var query = client.query('insert into users (email, password, fname, lname) values($1,$2,$3,$4)', [req.body.email, hashedPassword, req.body.fname, req.body.lname]);
    query.on('error', (err) => {
      console.log(err);
      if (err.code === '23505') {
        res.status(409).json({
          success: false,
          duplicate_email: true,
          error: err
        })
      } else {
        res.status(500).json({
          success: false,
          error: err
        });
      }
      done();
    });
    query.on('end', () => {
      done();
      res.status(201).json({
        success: true,
        message: "Account created. Please login"
      });
    });
  });
});

router.post('/forgot', function (req, res) {
  var email = req.body.email;
  const results = [];
  async.waterfall([
    function (done) {
      crypto.randomBytes(30, function (err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function (token, done) {
      pg.connect(connectionString, function (err, client, close) {
        if (err) {
          close();
          console.log(err);
          return res.status(500).json({
            success: false,
            data: err
          });
        }

        var query = client.query('select email from users where email=($1)', [email]);
        query.on('error', (err) => {
          close();
          console.log(err);
          res.status(500).json({
            success: false,
            error: err
          });
        });
        query.on('row', (row) => {
          results.push(row);
        });
        query.on('end', () => {
          if (results.length != 1) {
            close();
            res.status(404).json({
              success: false,
              error: "A fatal error occured with results from the database (0 or multiple users returned for email entered)"
            });
          } else {
            var expiry = Date.now() + 3600000;
            console.log(expiry.toString() + "|");
            query = client.query('update users set resetpasswordtoken=($1), resetpasswordexpiry=($2) where email=($3)', [token, expiry.toString(), email]);
            query.on('error', (err) => {
              close();
              console.log(err);
              res.status(500).json({
                success: false,
                error: err
              });
            });
            query.on('end', () => {
              close();
              done(err, token, email);
            })
          }
        });
      });
    },
    function (token, email, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: 'southwest.corner1@gmail.com',
          pass: 'HarE3qEWjvWuQNEiCdcGUTxL'
        }
      });
      var mailOptions = {
        to: email,
        from: 'passwordreset@demo.com',
        subject: 'Southwest Corner Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'https://' + req.headers.host + '/api/auth/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function (err) {
        if (err) {
          console.log(err);
        }
        res.json({
          success: true,
          message: "Password reset email sent. Check your email."
        });
        done(err, 'done');
      });
    }
  ]);

});

router.get('/reset/:token', function (req, res) {
  const results = [];
  pg.connect(connectionString, function (err, client, done) {
    if (err) {
      done();
      console.log(err);
      return res.status(500).json({
        success: false,
        error: err
      });
    }

    var query = client.query('select * from users where resetpasswordtoken=($1)', [req.params.token]);
    query.on('error', (err) => {
      console.log(err);
      res.status(500).json({
        success: false,
        error: err
      });
    });
    query.on('row', (row) => {
      results.push(row);
    });
    query.on('end', () => {
      console.log("HI");
      if (results.length !== 1) {
        return res.status(500).json({
          success: false,
          error: "fatal"
        });
      }
      var now = Date.now().toString();
      res.render('reset', {
        email: results[0].email
      });
    })

  })
});

router.post('/reset/:token', function (req, res) {
  async.waterfall([
    function (done) {
      const results = [];

      pg.connect(connectionString, function (err, client, done) {
        if (err) {
          done();
          console.log(err);
          return res.status(500).json({
            success: false,
            error: err
          });
        }

        var query = client.query('select * from users where resetpasswordtoken=($1)', [req.params.token]);
        query.on('error', (err) => {
          console.log(err);
          res.status(500).json({
            success: false,
            error: err
          });
        });
        query.on('row', (row) => {
          results.push(row);
        });
        query.on('end', () => {
          console.log("HI");
          var result = results[0];
          var hashedPassword = bcrypt.hashSync(req.body.password, 8);
          query = client.query('update users set resetpasswordtoken=NULL, resetpasswordexpiry=NULL, password=($1) where resetpasswordtoken=($2)', [hashedPassword, req.params.token]);
          res.send('Password changed successfully');
          done();
        });
      });
    }
  ], function (err) {
    res.redirect('/');
  });
});


router.get('/refresh', VerifyToken, function(req,res,next){
  var newToken = jwt.sign({
    email: req.email,
    scope: req.scope
  }, config.secret, {
    expiresIn: 86400 // expires in 24 hours
  });
  res.status(200).json({auth: true, token: newToken, scope: req.scope})
});

router.get('/me', VerifyToken, function(req, res, next) {
  // console.log(req);
  const results = [];
  pg.connect(connectionString, function (err, client, done) {
    if (err) {
      done();
      console.log(err);
      return res.status(500).json({
        success: false,
        error: err
      });
    }
    var query = client.query("select * FROM USERS where email=($1);", [req.email]);
    query.on('error', (err) => {
      console.log(err);
      res.status(500).json({
        success: false,
        error: err
      });
    });
    query.on('row', (row) => {
      results.push(row);
    })
    query.on('end', () => {
      done();
      res.status(200).json({
        authenticated: true,
        email: results[0].email,
        fname: results[0].fname,
        lname: results[0].lname,
        scope: req.scope
      });
    })
  })
});


module.exports = router;