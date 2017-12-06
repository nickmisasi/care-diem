var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('../../config'); // get our config file

function verifyPermission(scope) {
    return function (req, res, next) {
        var header = req.headers;
        var token = header['x-access-token'];
        if (!token)
            return res.status(401).send({
                auth: false,
                message: 'No token provided.'
            });
        // verifies secret and checks exp
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err)
                return res.status(401).send({
                    auth: false,
                    message: 'Failed to authenticate token.'
                });
            if(decoded.scope === scope || (scope === "sw" && req.scope === "admin")){
                req.email = decoded.email;
                req.scope = decoded.scope;
                next();
            }else{
                res.status(403).json({auth: true, required_scope_met: false});
            }
        });
    }
}

module.exports = verifyPermission;