var redis = require('redis-node');
var util = require('util');

var redisClient = redis.createClient(6379);
var publishCount = 0;
var clientCount = 0;

var tempCount = 0;
var tempTime = 0;

redisClient.on('connected', function() {
	redisClient.llen('juggernaut_clients', function(err, l) {
		if (err) throw err;

		clientCount = l;

		var i = 0;
		while (i < l) {
			redisClient.lindex('juggernaut_clients', i, function(err, id) {
				if (err) throw err;

				processClient(id);
			});

			i++;
		}

		redisClient.del('juggernaut_clients');
	});
});

function processClient(id) {
	var key = 'juggernaut_client:' + id;

	redisClient.llen(key, function(err, l) {
		if (err) throw err;

		publishCount += l;
		tempCount += l;

		var i = 0;
		while(i < l) {
			redisClient.lindex(key, i, function(err, time) {
				if (err) throw err;

				tempTime += parseInt(time);
				publishCount--

				if (publishCount === 0) {

					util.log('Average time: ' + tempTime/tempCount);
					util.log('Client count: ' + clientCount);

					process.exit(0);
				}
			});

			i++;
		}
		
		redisClient.del(key);
	});
}