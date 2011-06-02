var WebSocket = require('websocket-client').WebSocket;
var util = require('util');
var redis = require('redis-node');

var JuggernautClient = function() {
	this.__ws = new WebSocket('ws://127.0.0.1:8080/socket.io/websocket');

	this.__handleOpenClosure = this.__handleOpen.bind(this);
	this.__handleDataClosure = this.__handleData.bind(this);
	this.__handleCloseClosure = this.__handleClose.bind(this);

	this.__ws.addListener('open',    this.__handleOpenClosure);
	this.__ws.addListener('message', this.__handleDataClosure);
	this.__ws.addListener('error',   this.__handleCloseClosure);
	this.__ws.addListener('close',   this.__handleCloseClosure);

	this.__handshaked = false;
	this.__id = null;
};

JuggernautClient.prototype.send = function(data) {
	this.__ws.send(data);
};

JuggernautClient.prototype.__handleOpen = function(event) {
	util.log('Opened');
};

JuggernautClient.prototype.__handleData = function(data) {
	if (!this.__handshaked) {
		this.__handshaked = true;

		this.__id = data.split('~m~').pop();

		redisClient.rpush('juggernaut_clients', this.__id);

		this.__ws.send('~m~38~m~{"type":"subscribe","channel":"test"}');
	} else {
		if (data.indexOf('~h~') != -1) {
			var h = data.split('~h~').pop();
			var msg = '~h~' + h;
			this.send('~m~' + msg.length + '~m~' + msg);
		} else {
			var result = JSON.parse(data.split('~m~').pop()); // Самое медленное сообщение

			redisClient.rpush(
				'juggernaut_client:' + this.__id,
				Date.now() - parseInt(result.data)
			);

			util.log(Date.now() - parseInt(result.data));
		}
	}
};

JuggernautClient.prototype.__handleClose = function(event) {
	util.log('Closed');
};

var redisClient = redis.createClient(6379);
redisClient.on('connected', function() {
	for (var i = 0; i < 250; i++) {
		new JuggernautClient();
	}
});