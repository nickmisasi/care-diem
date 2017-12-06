var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('../../config'); // get our config file

function verifyToken(req, res, next) {

  // check header or url parameters or post parameters for token
  var header = req.headers;
  var token = header['x-access-token'];
  if (!token) 
    return res.status(401).send({ auth: false, message: 'No token provided.' });

  // verifies secret and checks exp
  jwt.verify(token, config.secret, function(err, decoded) {      
    if (err) 
      return res.status(401).send({ auth: false, message: 'Failed to authenticate token.' });    
    // if everything is good, save to request for use in other routes
    req.email = decoded.email;
    req.scope = decoded.scope;
    next();
  });

}

module.exports = verifyToken;