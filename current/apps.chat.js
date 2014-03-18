Chat = function(bopclient, bopcast, textel) {
    if(!(this instanceof Chat)) {
        return new Chat(bopclient, bopcast);
    }

    this._bopclient = bopclient;
    this._bopcast = bopcast;
    this._bopcast.addCallback(this._onMessage.bind(this));
    this._textel = textel;
    
    return this;
};

Chat.prototype = {
    _onMessage: function(msg, from) {
        if (msg.type !== 'chat' ) {
            return;
        }
        var oldMessages = this._textel.val();
        this._textel.val(oldMessages + "\n" + msg.from + ': ' + msg.text);
        this._textel.scrollTop(this._textel[0].scrollHeight);
    },
    sendMessage: function(from, text) {
        this._bopcast.send({type:'chat', from:from, text:text});
    }
};


