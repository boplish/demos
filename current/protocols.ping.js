Ping = function(bopclient) {
    if(!(this instanceof Ping)) {
        return new Ping(bopclient);
    }
    this._bopclient = bopclient;
    this._protocolName = 'ping-protocol';
    this._bopclient.setOnMessageHandler(this._protocolName, this._onMessage.bind(this));
    this._pendingPings = {};
    return this;
};

Ping.prototype = {
	_onMessage: function(msg, from) {
		if (msg.type === 'ping') {
			this._bopclient.send(from, this._protocolName, {
				date: Date(),
				type: 'pong',
				ref: msg.ref
			});
		} else if (msg.type ==='pong') {
			var ref = msg.ref;
			if (this._pendingPings[ref]) {
				var diff = Math.abs(new Date() - this._pendingPings[ref].date);
				try {
					this._pendingPings[ref].cb(null, diff);
				} catch(e) {}
				delete this._pendingPings[ref];
			}
		}
	},
	sendPing: function(to, timeout, cb) {
		var ref = Math.floor((Math.random() * 100000) +1);
		this._pendingPings[ref] = {
			date: new Date(),
			type: 'ping',
			ref: ref,
			cb: cb
		};
		if (typeof(timeout) === 'number') {
			setTimeout(function() {
				if (this._pendingPings[ref]) {
					delete this._pendingPings[ref];
					cb(to + ' timed out');
				}
			}.bind(this), timeout);
		}
		this._bopclient.send(to, this._protocolName, this._pendingPings[ref]);
	}
};
