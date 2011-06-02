var util = require('util'),
	http = require('http');

var Request = module.exports = function(options) {
	process.EventEmitter.call(this);

    this._options = options;

    this._request = null;
    this._response = null;
    this._responseBody = null;

	this.__onError = this._onError.bind(this);
	this.__endRequest = this._endRequest.bind(this);
	this.__collectResponseData = this._collectResponseData.bind(this);
};

util.inherits(Request, process.EventEmitter);

Request.prototype.send = function(body) {
    if (body) {
        if (this._options.method == 'GET') {
            this._options.path += (this._options.path.indexOf('?') === -1 ? '?' : '&') + qs.escape(body);
        }
    }

    this._request = http.request(this._options, this._onResponse.bind(this));
    this._request.on('error', this.__onError);

    if (body) {
        this._request.write(body);
    }

    this._request.end();
};

Request.prototype._onResponse = function(response) {
    this._response = response;
    this._responseBody = '';
    this._response.on('data', this.__collectResponseData);
    this._response.on('end', this.__endRequest);
};

Request.prototype._collectResponseData = function(chunk) {
    this._responseBody += chunk;
};

Request.prototype._endRequest = function() {
    if (this._response.statusCode == 200) {
        this.emit('ready', this._responseBody);
    } else {
        this.emit('error', this._response.statusCode + ' - ' + this._responseBody);
    }

	this._request = null;
};

Request.prototype._onError = function(error) {
    this.emit('error', 'Can\'t send request:' + error);
};
