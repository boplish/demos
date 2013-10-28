BopCast = function(bopclient) {
    if(!(this instanceof BopCast)) {
        return new BopCast(bopclient);
    }
    this._bopclient = bopclient;
    this._protocolName = 'bopcast-protocol';
    this._bopclient.setOnMessageHandler(this._protocolName, this._onMessage.bind(this));
    this._receivers = [];
    this._callbacks = [];
    return this;
};

BopCast.prototype = {
    _onMessage: function(msg, from) {
        var i;
        if (msg.type === 'register-request') {
            this._onRegisterRequest(msg.data, from);
        } else if (msg.type === 'register-propagate') {
            this._onRegisterPropagate(msg.data, from);
        } else if (msg.type === 'register-response') {
            this._addReceiver(from);
        } else if (msg.type === 'deliver') {
            for (i=0; i<this._callbacks.length; i++) {
                this._callbacks[i](msg.data, from);
            }
        }
    },
    /** 
     * A peer wants to join the group, send a registry request to the group
     *
     */
    _onRegisterRequest: function(msg, from) {
        this._multicast('register-propagate', from);
    },
    /**
     * Propagated peer join if the peer is not already registered. Add peer and acknowledge.
     *
     */
    _onRegisterPropagate: function(data, from) {
        if (this._addReceiver(data) !== -1) {
            this._bopclient.send(data, this._protocolName, {
                type: 'register-response',
                data: ''
            });
        }
    },
    _addReceiver: function(id) {
        if (this._receivers.indexOf(id) === -1 && id !== this._bopclient.id) {
            console.log('registered receiver: ' + id);
            return this._receivers.push(id);
        }
        console.log('duplicate receiver: ' + id);
        return -1;
    },
    /**
     * Send a message to all members of the group including me
     *
     */
    _multicast: function(type, rawMsg) {
        var msg = {
            type: type,
            data: rawMsg
        };
        for (i=0; i<this._receivers.length; i++) {
            this._bopclient.send(this._receivers[i], this._protocolName, msg);
        }
        setTimeout(function(){
            this._onMessage(msg, this._bopclient.id);
        }.bind(this),0);
    },
    /**
     * Send a message to the group
     *
     */
    send: function(msg) {
        this._multicast('deliver', msg);
    },
    /**
     * Register peer in group
     *
     */
    register: function(peer) {
        this._bopclient.send(peer, this._protocolName, {
            type: 'register-request',
            data: this._bopclient.id
        });
    },
    /**
     * Returns all current receivers
     *
     */
    getReceivers: function() {
        return this._receivers;
    },

    addCallback: function(callback) {
        this._callbacks.push(callback);
    }
};
