var http = require('http'),
	util = require('util'),
	redis = require('redis-node')
	im = require('imagemagick');;

var express = require('./vendor/express');

var Beseda = require('./vendor/beseda');

var IMG_FOLDER = '';
var IMG_FOLDER_URL = '';

var LAST_IMAGE_ID = 0;

///////////////////////////////////////////////////////////////////////////////

var server = express.createServer();

server.get('/', serveIndex);
server.get('/index.html', serveIndex);
server.get('/static/:folder/:file', serveStatic);
server.get('/images', serveImages);
server.get('/messages', serveMessages);

server.listen(4000);

var beseda = new Beseda({ server : server });

var client = redis.createClient(6379/**, '192.168.1.161'*/);

client.on('connected', function() {
	util.print('Connected to Redis!\n');
});

client.on('connection error', function(error) {
	util.print('Redis connection error: ' + error + '\n');
});

client.subscribeTo('Geometria_Streaming:kanon', function(channel, message) {
	var url = message;
	var prefix = 'image_' + LAST_IMAGE_ID++;
	var original = prefix + '.jpg'
	var preview = prefix + '_preview.jpg'
	var thumbnail = prefix + '_thumb.jpg'

	var i = 0;
	var callback = function() {
		i++;

		if (i === 1) {
			sendImage(
				IMG_FOLDER_URL + original,
				IMG_FOLDER_URL + preview,
				IMG_FOLDER_URL + thumbnail
			);
		}
	}

	convertOriginal(url, IMG_FOLDER + original, callback);
	convertPreview(url, IMG_FOLDER + preview, callback);
	convertThumb(url, IMG_FOLDER + thumbnail, callback);
});

function sendImage(original, preview, thumbnail) {
	beseda.publish('/live', {
		id: ++LAST_IMAGE_ID,
		status: 1,
		originalUrl: original,
		previewUrl: preview,
		thumbnailUrl: thumbnail,
		createdAt: (Date.now() / 1000) | 0
	});
}

function convertOriginal(url, name, callback) {
	im.convert([
		'-resize',
		'1280x1024',
		url,
        '-sampling-factor',
		'2x1',
        '-support',
		'0.9',
		'-resize',
		'1280x1024',
		'-format',
		'"%w %h %[EXIF:DateTime]"',
		'-identify',
		'-quality','90',
		name
	], function(err, stdout, stderr){
			if (err) throw err;

			console.log('stdout:', stdout);

			callback();
		}
	);
}

function convertPreview(url, name, callback) {
	im.convert([
		'-resize', '150x200',
		url,
        '-sampling-factor','2x1',
        '-support', '0.9',
		'-resize', '150x200',
		'-format', '"%w %h %[EXIF:DateTime]"',
		'-identify',
		'-quality', '90',
		name
	], function(err, stdout, stderr){
			if (err) throw err;

			console.log('stdout:', stdout);

			callback();
		}
	);
}

function convertThumb(url, name, callback) {
	im.convert([
		'-resize', '76x76',
		url,
        '-thumbnail','76x76^',
        '-unsharp','0x1+1+0',
        '-quality','90',
        '-flatten',
        '-gravity','center',
        '-extent', '76x76',
        name
	], function(err, stdout, stderr){
			if (err) throw err;

			console.log('stdout:', stdout);

			callback();
		}
	);
}

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
			createdAt: (Date.now() / 1000) | 0
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
