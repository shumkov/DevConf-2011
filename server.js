var http    = require('http'),
	util    = require('util'),
	redis   = require('redis-node'),
    im      = require('imagemagick'),
	qs      = require('querystring'),
    Beseda  = require('beseda'),
    Router  = require('beseda/server/lib/router.js');


var redisClient = redis.createClient(6379/*, '192.168.1.161'*/);
var pubsubClient = redis.createClient(6379/*, '192.168.1.161'*/);

var router = new Router();

router.get('/crossdomain.xml', function(request, response) {
	response.writeHead(200, {'Content-Type': 'text/xml' });
	response.end(
		'<?xml version="1.0"?>' +
		'<!DOCTYPE cross-domain-policy SYSTEM "/xml/dtds/cross-domain-policy.dtd">' +
		'<cross-domain-policy>' +
			'<site-control permitted-cross-domain-policies="all"/>' +
			'<allow-access-from domain="*" to-ports="*" />' +
			'<allow-http-request-headers-from domain="*" headers="*"/>' +
		'</cross-domain-policy>'
	);
});

var server = http.createServer(function(request, response) {
    if (!router.dispatch(request, response)) {
        response.writeHead(404);
        response.end();
    }
});

server.listen(4000);

var beseda = new Beseda({ server : server, pubSub: 'redis' });

///////////////////////////////////////////////////////////////////////////////
//
//      MESSAGE MANIPULATION
//
///////////////////////////////////////////////////////////////////////////////

//-----------------------------------------------------------------------------
//     Routes
//-----------------------------------------------------------------------------

router.get('/messages', allMessagesRequest);
router.post('/messages/new', newMessageRequest);
router.get('/messages/delete', deleteAllMessagesRequest);

function allMessagesRequest(request, response) {
	var data = '{"items":[';

	var callback = function(message, isLast) {
		if (isLast)
			response.end(data + message + ']}');
		else data += message + ',';
	};

	redisClient.llen('messages', function(err, l){
		if (l != 0) requestMessages(l, callback)
		else callback('', true);
	});
}

function newMessageRequest(request, response) {
	var data = '';

    request.on('data', function(chunk){ data += chunk; });
	request.on('end', function(){
		applyMessage(data);
		response.end();
	});
}

function deleteAllMessagesRequest(request, response) {
	response.end('OK!');

	redisClient.del('messages');
	redisClient.del('last_message_id');
}

//-----------------------------------------------------------------------------
//      Sending all messages
//-----------------------------------------------------------------------------

function requestMessages(l, callback) {
	var i = 0;
	while (i < l) {
		writeMessage(i, callback, i == l - 1);

		i++;
	}
}

function writeMessage(index, callback, isLast) {
	redisClient.lindex('messages', index, function(err, message) {
		callback(message, isLast);
	});
};

//-----------------------------------------------------------------------------
//      Message receiving
//-----------------------------------------------------------------------------

function applyMessage(data) {
	redisClient.incr('last_message_id', function(err, id) {
		if (id) {
			var query = qs.parse(data);

			var message = buildMessage(id, query);
			saveMessage(message)

			message.sign = query.sign;
			publishMessage(message);
		}
	});
}

function buildMessage(id, query) {
	return {
		id: id,
		text: query.text,
		createdAt: (Date.now() / 1000) | 0,
		userName: query.userName,
		pictureId: query.pictureId,
		userId: query.userId
	};
}

function saveMessage(message) {
	redisClient.rpush('messages', JSON.stringify(message));
}

function publishMessage(message) {
	beseda.publish('/live', JSON.stringify({
		action: 'message.new',
		data: message
	}));
}

///////////////////////////////////////////////////////////////////////////////
//
//      IMAGE MANIPULATION
//
///////////////////////////////////////////////////////////////////////////////

//-----------------------------------------------------------------------------
//      Constants
//-----------------------------------------------------------------------------

var IMG_FOLDER = '/mnt/betta-pics/streaming/pics/';
var IMG_FOLDER_URL = 'http://192.168.1.3/streaming/pics/';

//-----------------------------------------------------------------------------
//      Routes
//-----------------------------------------------------------------------------

router.get('/images', allImageRequest);
router.get('/images/delete', deleteAllImagesRequest);

function allImageRequest(request, response) {
	var data = '{"items":[';

	var callback = function(message, isLast) {
		if (isLast)
			response.end(data + message + ']}');
		else data += message + ',';
	};

	redisClient.llen('images', function(err, l){
		if (l != 0) requestImages(l, callback)
		else callback('', true);
	});
}

function deleteAllImagesRequest(request, response) {
	response.end('OK!');

	redisClient.del('images');
	redisClient.del('last_image_id');
}

//-----------------------------------------------------------------------------
//      Image convertion
//-----------------------------------------------------------------------------

function convertOriginal(url, name, callback) {
	im.convert([
		'-resize', '1280x1024', url, '-sampling-factor', '2x1',  '-support', '0.9',
		'-resize', '1280x1024', '-format', '"%w %h %[EXIF:DateTime]"',
		'-identify', '-quality','90', name
	], callback);
}

function convertPreview(url, name, callback) {
	im.convert([
		'-resize', '150x200', url, '-sampling-factor','2x1', '-support', '0.9',
		'-resize', '150x200', '-format', '"%w %h %[EXIF:DateTime]"',
		'-identify', '-quality', '90', name
	], callback);
}

function convertThumb(url, name, callback) {
	im.convert([
		'-resize', '76x76', url, '-thumbnail','76x76^', '-unsharp','0x1+1+0',
        '-quality','90', '-flatten', '-gravity','center', '-extent', '76x76',
        name
	], callback);
}

//-----------------------------------------------------------------------------
//     Image receiving (from redis)
//-----------------------------------------------------------------------------

pubsubClient.subscribeTo('Geometria_Streaming:kanon', newMessageNotification);

function newMessageNotification(channel, message) {
	redisClient.incr('last_image_id', function(err, id) {
		convertImage(id, message);
	});
}

function convertImage(id, path) {
	var prefix = 'image_' + id;
	var original = prefix + '.jpg'
	var preview = prefix + '_preview.jpg'
	var thumbnail = prefix + '_thumb.jpg'

	var i = 0;
	var callback = function() {
		i++;

		if (i === 3) applyImage(
			id,
			IMG_FOLDER_URL + original,
			IMG_FOLDER_URL + preview,
			IMG_FOLDER_URL + thumbnail
		);
	}

	convertOriginal(path, IMG_FOLDER + original, callback);
	convertPreview(path, IMG_FOLDER + preview, callback);
	convertThumb(path, IMG_FOLDER + thumbnail, callback);
}

function applyImage(id, original, preview, thumbnail) {
	var image = buildImage(id, original, preview, thumbnail);

	saveImage(image);
	publishImage(image);
}

function buildImage(id, original, preview, thumbnail) {
	return {
		id: id,
		status: 1,
		originalUrl: original,
		previewUrl: preview,
		thumbnailUrl: thumbnail,
		createdAt: (Date.now() / 1000) | 0
	}
}

function saveImage(image) {
	redisClient.rpush('images', JSON.stringify(image));
}

function publishImage(image) {
	beseda.publish('/live', JSON.stringify({
		action: 'picture.approve',
		data: image
	}));
}

//-----------------------------------------------------------------------------
//      Sending all images
//-----------------------------------------------------------------------------

function requestImages(l, callback) {
	var i = 0;
	
	while (i < l) {
		writeImage(i, callback, i == l - 1);
		i++;
	}
}

function writeImage(index, callback, isLast){
	redisClient.lindex('images', index, function(err, image) {
		callback(image, isLast);
	});
}
