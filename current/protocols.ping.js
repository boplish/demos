Ping = function(bopclient) {
    if(!(this instanceof Ping)) {
        return new Ping(bopclient);
    }
    this._bopclient = bopclient;
    this._protocolName = 'ping-protocol';
    this._bopclient.setOnMessageHandler(this._protocolName, this._onMessage.bind(this));
    this._timer = null;
    return this;
};

Ping.prototype = {
	_onMessage: function(msg, from) {
		if (msg.type === 'ping') {
			this._bopclient.send(from, this._protocolName, {
				date: Date(),
				type: 'pong'
			});
		} else if (msg.type ==='pong') {
			var diff = Math.abs(this._timer - new Date());
			console.log('pinging ' + from + ' took ' + diff + 'ms.');
		}
	},
	sendPing: function(to) {
		this._timer = new Date();
		this._bopclient.send(to, this._protocolName, {
			date: Date(),
			type: 'ping'
		});
	}
};
