// Use : ex. node token.js ./config-prod.json (mind the ./)

var request = require('request');
var request = request.defaults({jar: true});
var conf = require('./config');
if (process.argv.length > 2) {
  conf = require(process.argv[2]);
  console.log('loading conf ' + process.argv[2]);
}
console.log('conf : ', conf);

var regCode = /code:<\/strong> (\w+)<\/p>/g;

var getRequestBin = {
	url: 'http://requestb.in/api/v1/bins',
	method: 'POST',
	followAllRedirects: true
};

//Get a bin first
request(getRequestBin, function(err, res, body) {
  var binId = JSON.parse(body).name;
	console.log("requestBinId : " + binId);
	login(binId, function() {
    getCodeFromKernel(binId, function(binId, code) {
      getCodeFromBin(binId, code, function(code) {
        getToken(binId, code, function(token) {           
          console.log('\n**********TOKEN**********');
          console.log(token);
          console.log('**********TOKEN**********\n');
          testToken(token, function() {
            console.log('Done!');
          });
        });
      });
    });
	});
});

//Login as alice@example.com
var login = function(requestBinId, callback) {
  //If you want to use authUrl directly, you'd better comment 
  //getCodeFromKernel(binId, function(code) { }); above.
  var authUrl = conf.kernelBaseUrl + '/a/auth?response_type=code'
    + '&client_id=' + conf.app_client_id
    + '&scope=openid%20datacore%20profile%20email'
    + '&redirect_uri=http://requestb.in/' + requestBinId;

  var options = {
    rejectUnauthorized: false,
    url: conf.kernelBaseUrl + '/a/login',
    method: 'POST',
    followAllRedirects: true, // let redirect so that cookie will be stored (from Set-Cookie response header)
    headers: {
      referer: conf.kernelBaseUrl + '/a/login',
      'Accept-Encoding': 'gzip, deflate' // since Sept. 2014 else 500 error
    },
    jar: true, // store cookie in cookie.txt
    ///followRedirect: false, // not to uselessly go to 'continue' URL
    form: {
      u: conf.login,
      pwd: conf.password,
      _utf8: '☃',
      'continue': conf.kernelBaseUrl,
      //'continue': authUrl
    }
  };
  console.log("login options : ", options);
  request(options, function(err, res, body) {
    if(err) {
      console.log("Remote error in login() : " + err);
      return;
    }
    console.log("login res headers : ", res.headers);
    ///console.log("login body : ", body);
    callback(requestBinId);
  });
};


var getCodeFromKernel = function(requestBinId, callback) {
  var options = {
    rejectUnauthorized: false,
    url: conf.kernelBaseUrl + '/a/auth',
    method: 'POST',
    ///followAllRedirects: true, // don't redirect to be able to extract code from Location header
    headers: {
      referer: conf.kernelBaseUrl + '/a/login',
      'Accept-Encoding': 'gzip, deflate' // since Sept. 2014 else 500 error
    },
    form: {
      response_type: 'code',
      client_id: conf.app_client_id,
      client_secret: conf.app_client_secret,
      scope: 'openid datacore profile email',
      //redirect_uri: 'http://requestb.in/' + requestBinId // NO since Sept. 2014 has to be an approved app ex. portal
      redirect_uri: conf.redirect_uri
      /*state: 'a',
      nonce: 'b'*/ // not required
    }
  };
  console.log("getCodeFromKernel params : ", options.form);
  
  request(options, function(err, res, body) {
    // TODO approve if asked to
    if(err) {
      console.log("Remote error getCodeFromKernel : " + err);
      return;
    }
    console.log("getCodeFromKernel res headers: ", res.headers);
    var location = res.headers.location;
    if (!location) {
      if (body.indexOf("<html>") != -1 && body.indexOf("Authorize") != -1) {
        console.log("Must authorize first, browse to URL...", body);
        return;
      }
      console.log("Bad response getCodeFromKernel (no location) : ", body, res.headers);
      return;
    }
    var beforeLocationCode = "code=";
    var beforeLocationCodeIndex = location.indexOf(beforeLocationCode);
    if (location.indexOf(beforeLocationCode) === -1) {
      console.log("Bad response getCodeFromKernel, location without code : ", location);
      return;
    }
    var code = location.substring(beforeLocationCodeIndex + beforeLocationCode.length);
    ///console.log("getCodeFromKernel body: ", body);
    console.log("getCodeFromKernel code: ", code);
    callback(requestBinId, code);
  });
};


var getCodeFromBin = function(requestBinId, code, callback) {
  if (code) {
    return callback(code);
  }

  var options = {
    url: 'http://requestb.in/' + requestBinId + '?inspect',
    method: 'GET',
    followAllRedirects: true
  };

  request(options, function(err, res, body) {
    if(err) {
      console.log("Remote error in getCodeFromBin() : " + err);
      return;
    }
    //console.log("getCodeFromBin body : " + body);
    var code = regCode.exec(body);
    if(code) {
      console.log("code : " + code[1]);
      callback(code[1]);
    } else {
      callback(null);
    }
  });
};


var getToken = function(requestBinId, code, callback) {
  var appBasicAuth = 'Basic ' + new Buffer(conf.app_client_id + ':' + conf.app_client_secret).toString("base64");
  var options = {
    rejectUnauthorized: false,
    url: conf.kernelBaseUrl + '/a/token',
    method: 'POST',
    headers: {
      'Authorization': appBasicAuth
    },
    form: {
      grant_type: 'authorization_code',
      //redirect_uri: 'http://requestb.in/' + requestBinId // NO since Sept. 2014 has to be an approved app ex. portal
      redirect_uri: conf.redirect_uri,
      code: code
    }
  };

  console.log("getToken req : ", options);
  request(options, function(err, res, body) {
    if(err) {
      console.log("Remote error in getToken() : " + err);
      return;
    }
    console.log("getToken body ", body);
    callback(JSON.parse(body).access_token);
  });
};

var testToken = function(token, callback) {
  var options = {
    rejectUnauthorized: false,
    url: conf.kernelBaseUrl + '/a/userinfo',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/json'
    }
  };
  
  request(options, function(err, res, body) {
    if(err) {
      console.log("Remote error in testToken() : " + err);
      return;
    }
    console.log('Should display information about the user:');
    console.log(body);
  
  request({
    rejectUnauthorized: false,
    url: conf.datacoreTestUrl,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/json'
    }
  }, function(err, res, body) {
    if(err) {
      console.log("Remote error in testToken() : " + err);
      return;
    }
    console.log('Should display information about Datacore Resource ' + conf.datacoreTestUrl + ':');
    console.log(body);
  
  var dcBasicAuth = 'Basic ' + new Buffer(conf.dc_client_id + ':' + conf.dc_client_secret).toString("base64");
  request({
    rejectUnauthorized: false,
    url: conf.kernelBaseUrl + '/a/tokeninfo',
    method: 'POST',
    headers: {
      'Authorization': dcBasicAuth,
      'Accept': 'application/json'
    },
    form: {
      token_type_hint: 'access_token',
      token: token
    }
  }, function(err, res, body) {
    if(err) {
      console.log("Remote error in testToken() : " + err);
      return;
    }
    console.log('Should display information about token from ' + conf.dc_client_id + ':');
    //console.log(res);
    console.log(body);
    console.log(" and sub_groups: " + JSON.parse(body)["sub_groups"]);

  });

  });

    callback();
  });
};
