var util = require('util');
var Request = require('./Request');
var redis = require('redis-node');

function merge (object, extend) {
    for (var p in extend) {
        try {
            if (extend[p].constructor == Object) {
                object[p] = exports.merge(object[p], extend[p]);
            } else {
                object[p] = extend[p];
            }
        } catch (e) {
            object[p] = extend[p];
        }
    }

    return object;
};


///////////////////////////////////////////////////////////////////////////////

var CONNECTION_OPTIONS = {
	method : 'GET',
	host   : '127.0.0.1',
	port   : '8080',
	ssl    : false,
	path   : '/socket.io/xhr-polling//' + Date.now()
};

var SEND_OPTIONS = {
	method : 'POST',
	host   : '127.0.0.1',
	port   : '8080',
	ssl    : false
};

var POLL_OPTIONS = {
	method : 'GET',
	host   : '127.0.0.1',
	port   : '8080',
	ssl    : false
};


var JuggernautClient = function()  {
	this.__id = null;

	this.__connectionRequest = new Request(CONNECTION_OPTIONS);
	this.__sendRequest = null;
	this.__pollRequest = null;

	this.__connectionRequest.on('ready', this.__handleJuggernaurConnect.bind(this));
	this.__connectionRequest.on('error', this.__handleConnectionError.bind(this));
	this.__connectionRequest.send();
};

JuggernautClient.prototype.__handleConnectionError = function() {
	util.log('Connection error');
};

JuggernautClient.prototype.__handleJuggernaurConnect = function(data) {
	this.__id = data.split('~').pop();

	util.log('Connected ' + this.__id);

	redisClient.rpush('juggernaut_clients', this.__id);

	this.__pollRequest =  new Request(merge({
		path: '/socket.io/xhr-polling/' + this.__id + '/' + Date.now()
	}, POLL_OPTIONS));

	this.__pollRequest.on('ready', this.__handlePoll.bind(this));
	this.__pollRequest.on('error', this.__handlePollError.bind(this));

	this.__pollRequest.send();

	this.__sendRequest =  new Request(merge({
		path: '/socket.io/xhr-polling/' + this.__id + '/send' + Date.now()
	}, SEND_OPTIONS));
	this.__sendRequest.on('ready', this.__handleSend.bind(this));
	this.__sendRequest.on('error', this.__handleSendError.bind(this));

	this.__sendRequest.send('data=~m~38~m~{"type":"subscribe","channel":"test"}');
};

JuggernautClient.prototype.__handleSend = function(data) {
	util.log('Data sent: ' + data + ' by ' + this.__id);
};

JuggernautClient.prototype.__handleSendError = function(data) {
	util.log('Data sent error by ' + this.__id);
};

JuggernautClient.prototype.__handlePoll = function(data) {
	util.log('Poll sent by ' + this.__id + '. Result: ' + data);

	try {

		var result = JSON.parse(data.split('~m~')[2]); // Самое медленное сообщение


		redisClient.rpush(
			'juggernaut_client:' + this.__id,
			Date.now() - parseInt(result.data)
		);

		util.log(Date.now() - parseInt(result.data));
	} catch (error) {};
	
	this.__pollRequest.send();
};

JuggernautClient.prototype.__handlePollError = function(data) {
	util.log('Poll error by ' + this.__id);
};

///////////////////////////////////////////////////////////////////////////////

var redisClient = redis.createClient(6379);
redisClient.on('connected', function() {
	for (var i = 0; i < 4; i++) {
		new JuggernautClient();
	}
});