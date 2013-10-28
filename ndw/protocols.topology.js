TopologyDiscover = function(bopclient) {
    if(!(this instanceof TopologyDiscover)) {
        return new TopologyDiscover(bopclient);
    }
    this._bopclient = bopclient;
    this._protocolName = 'topo-protocol';
    this._callback = function(){};
    this._bopclient.setOnMessageHandler(this._protocolName, this._onMessage.bind(this));
    return this;
};

TopologyDiscover.prototype = {
	_onMessage: function(msg, from) {
		if (msg.type === 'request') {
            this._onTopologyRequest(msg, from);
		} else if (msg.type ==='response') {
			this._onTopologyResponse(msg, from);
		} else {
			throw Error(this._protocolName + ': unknown type: ' + msg.type);
		}
	},
    _onTopologyResponse: function(msg, from) {
        this._callback(msg.connected_peers, from);
    },
    _onTopologyRequest: function(msg, from) {
        this._sendResponse(from);
    },
    _sendResponse: function(to) {
        this._bopclient.send(to, this._protocolName, {
            type: 'response',
            connected_peers: this._bopclient.getConnectedPeers()
        });
    },
    registerCallback: function(callback) {
        this._callback = callback;
    },
	sendRequest: function() {
		var peers = this._bopclient.getConnectedPeers();
		for (var i=0; i<peers.length; i++) {
			this._bopclient.send(peers[i], this._protocolName, {
				type: 'request'
			});
		}
	}
};