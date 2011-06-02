var redis = require('redis-node');

var redisClient = redis.createClient(6379);
redisClient.on('connected', function() {
	for (var i = 0; i < 1; i++) {
		redisClient.publish('juggernaut', JSON.stringify({
			channels: ['test'], data: Date.now()
		}));

		process.exit(0);
	}
});