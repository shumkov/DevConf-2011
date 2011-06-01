var http = require('http'),
	util = require('util'),
	redis = require('redis-node');

var express = require('./vendor/express');

var Beseda = require('./vendor/beseda');

///////////////////////////////////////////////////////////////////////////////

var server = express.createServer();

server.get('/', serveIndex);
server.get('/index.html', serveIndex);
server.get('/static/:folder/:file', serveStatic);
server.get('/images', serveImages);
server.get('/messages', serveMessages);

server.listen(4000);

var beseda = new Beseda({ server : server });

var client = redis.createClient(6379);

client.on('connected', function() {
	util.print('Connected to Redis!\n');
});

client.on('connection error', function(error) {
	util.print('Redis connection error: ' + error + '\n');
});

client.subscribeTo('hello', function(channel, message) {
	util.print(message + '\n');
});


///////////////////////////////////////////////////////////////////////////////

function serveIndex(request, response) {
	response.sendfile(__dirname + '/public/index.html');
}

function serveStatic(request, response) {
	response.sendfile(
		__dirname + '/public/' + request.params.folder +
						   '/' + request.params.file
	);
}

function serveImages(request, response) {
	response.end(JSON.stringify({
		items: [{
			id: 1,
			status: 1,
			originalUrl: 'http://cs849.vkontakte.ru/u28117948/94411735/x_56ffb10b.jpg',
			previewUrl: 'http://cs849.vkontakte.ru/u28117948/94411735/m_f2da357c.jpg',
			thumbnailUrl: 'http://392.gt2.vkadre.ru/assets/thumbnails/2612f4b370999652.130.vk.jpg',
			createdAt: 1306850749
		}]
	}));
}

function serveMessages(request, response) {
	response.end(JSON.stringify({
		items: [{
			id: 1,
			text: 'Hello everyone!!!',
			createdAt: new Date(),
			userName: 'Kononenko',
			pictureId: 1
		}]
	}));
}
