TopologyDiscover = function(bopclient) {
    if(!(this instanceof TopologyDiscover)) {
        return new TopologyDiscover(bopclient);
    }
    this._protocolName = 'topo-protocol';
    this._bopclient = bopclient;
    this.proto = bopclient.registerProtocol(this._protocolName);
    this.proto.onmessage = this._onMessage.bind(this);
    this.proto.group.subscribe('topo-protocol', function(err, msg) {
        if (!err) console.log('subscribed to topo protocol');
        else console.log('err subscribing to topo protocol');
    });
    this.proto.group.onmessage = function(group, msg) {
        this._onTopologyRequest(msg, msg.from);
    }.bind(this);
    return this;
};

TopologyDiscover.prototype = {
	_onMessage: function(from, msg) {
		if (msg.type === 'request') {
            this._onTopologyRequest(msg, from);
		} else if (msg.type ==='response') {
			this._onTopologyResponse(msg, from);
		} else {
			throw Error(this._protocolName + ': unknown type: ' + msg.type);
		}
	},
    _onTopologyResponse: function(msg, from) {
        if (typeof this.onmessage === 'function') {
            return this.onmessage(msg, from);
        }
    },
    _onTopologyRequest: function(msg, from) {
        this._sendResponse(from);
    },
    _sendResponse: function(to) {
        var suc = this._bopclient._router._localNode.successor_id().toString();
        var pre = this._bopclient._router._localNode.predecessor_id().toString();
        // send topo info to remote peer
        this.proto.send(to, {
            type: 'response',
            from: this._bopclient._router.id.toString(),
            //connected_peers: this._bopclient._router.getFingerTable()
            connected_peers: [suc, pre]
        });
    },
	sendRequest: function() {
        this.proto.group.publish('topo-protocol', {from: this.proto.bopid}, function(err, msg) {
            if (!err) console.log('topo request sent');
            else console.log('err sending topo request');
        });
	}
};