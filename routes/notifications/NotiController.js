var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var pg = require('pg');
var async = require('async');
var nodemailer = require('nodemailer');
var gcm = require('node-gcm');


var VerifyToken = require(__root + '/routes/auth/VerifyToken');
var VerifyPermission = require('../auth/VerifyPermission')

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:southwestcorner@131.104.180.104:5432/nicktest';
pg.defaults.ssl = true;

var config = require('../../config');


var sender = new gcm.Sender('AIzaSyBoGf4udiz6sgs1CK4kc4DZVVjHdrGzSpU');

var message = new gcm.Message({
    contentAvailable: true,
    collapse_key: "score_update",
    delayWhileIdle: true,
    timeToLive: 108,
    dry_run: true,
    data: {
        key1: 'message1',
        key2: 'message2',
        notification: {
            title: "Hello, World",
            icon: "ic_launcher",
            body: "This is a notification that will be displayed if your app is in the background."
        }
    }

})
// Specify which registration IDs to deliver the message to
var regTokens = ['eA9lORgei_s:APA91bFn4-M7OMZOB_1R8kHEIEKPNaEkzhA4wtVt91ncRSH0ZzNxkoWmH_6llBDNRn_zXmadcgSJ0iVDQ0ZJ3tu07WmDwFuiwnHu9jaczleCmx7bBs6cNRza1tFHHp96I0uwioBZ57qC'];
 

router.get('/test', function(req, res, next){
    sender.send(message, { registrationTokens: regTokens }, function (err, response) {
        if (err) console.error(err);
        else console.log(response);
    });
})
// Actually send the message


module.exports = router;