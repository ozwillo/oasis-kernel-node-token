var request = require('request');
var request = request.defaults({jar: true});
var conf = require('./config');

var regCode = /code:<\/strong> (\w+)<\/p>/g;

var getRequestBin = {
	url: 'http://requestb.in/api/v1/bins',
	method: 'POST',
	followAllRedirects: true
};

//Get a bin first
request(getRequestBin, function(err, res, body) {
  var binId = JSON.parse(body).name;
	console.log(binId);
	login(binId, function() {
    getCodeFromKernel(binId, function(code) {
      getCodeFromBin(binId, function(code) {
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
    + '&client_id=' + conf.client_id
    + '&scope=openid%20datacore%20profile%20email'
    + '&redirect_uri=http://requestb.in/' + requestBinId;

  var options = {
    url: conf.kernelBaseUrl + '/a/login',
    method: 'POST',
    followAllRedirects: true,
    headers: {
      referer: conf.kernelBaseUrl + '/a/login'
    },
    form: {
      u: conf.login,
      pwd: conf.password,
      _utf8: '☃',
      'continue': conf.kernelBaseUrl,
      //'continue': authUrl
    }
  };
  request(options, function(err, res, body) {
    if(err) {
      console.log(err);
    }
    //console.log(body);
    callback(requestBinId);
  });
};


var getCodeFromKernel = function(requestBinId, callback) {
  var options = {
    url: conf.kernelBaseUrl + '/a/auth',
    method: 'POST',
    followAllRedirects: true,
    form: {
      response_type: 'code',
      client_id: conf.client_id,
      client_secret: conf.client_secret,
      scope: 'openid datacore profile email',
      redirect_uri: 'http://requestb.in/' + requestBinId
    }
  };
  
  request(options, function(err, res, body) {
    if(err) {
      console.log(err);
    }
    //console.log(body);
    callback(requestBinId);
  });
};


var getCodeFromBin = function(requestBinId, callback) {
  var options = {
    url: 'http://requestb.in/' + requestBinId + '?inspect',
    method: 'GET',
    followAllRedirects: true
  };

  request(options, function(err, res, body) {
    if(err) {
      console.log(err);
    }
    //console.log(body);
    var code = regCode.exec(body);
    if(code) {
      //console.log(code[1]);
      callback(code[1]);
    } else {
      callback(null);
    }
  });
};


var getToken = function(requestBinId, code, callback) {
  var auth = 'Basic ' + new Buffer(conf.client_id + ':' + conf.client_secret).toString("base64");
  var options = {
    url: conf.kernelBaseUrl + '/a/token',
    method: 'POST',
    headers: {
      'Authorization': auth
    },
    form: {
      grant_type: 'authorization_code',
      redirect_uri: 'http://requestb.in/' + requestBinId,
      code: code
    }
  };

  request(options, function(err, res, body) {
    if(err) {
      console.log(err);
    }
    console.log(body);
    //console.log(JSON.parse(body).id_token);
    callback(JSON.parse(body).access_token);
  });
};

var testToken = function(token, callback) {
  var options = {
    url: conf.kernelBaseUrl + '/a/userinfo',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/json'
    }
  };
  
  request(options, function(err, res, body) {
    if(err) {
      console.log(err);
    }
    console.log('Should display information about the user:');
    console.log(body);
    callback();
  });
};
