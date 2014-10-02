MessageInspector = function(bopclient, divHeaders, divMessage) {
    if(!(this instanceof MessageInspector)) {
        return new MessageInspector(bopclient, divHeaders, divMessage);
    }

    this._ul = document.createElement('ul');
    this._ul.className = 'list-unstyled';
    $(divHeaders).append(this._ul);
    this._pre = document.createElement('pre');
    this._pre.id = 'message-inspector-pre';
    $(divMessage).append(this._pre);
    
    this._messageQueue = new Array(10);
    this._bopclient = bopclient;
    this._bopclient.setMonitorCallback(this._onMessage.bind(this));
    return this;
};

MessageInspector.prototype = {
    _onMessage: function(msg) {
        this._messageQueue.push(msg);
        this._messageQueue.shift();
        this.outputMessageHeaders(this._ul);
    },
    outputMessage: function(el, index) {
        var html = JSON.stringify(this._messageQueue[index], undefined, 2);
        $('#message-inspector-pre').html(html);
    },
    outputMessageHeaders: function(el) {
        var self = this;
        el.innerHTML = '';
        for (var i=this._messageQueue.length-1; i>=0; i--) {
            if (typeof(this._messageQueue[i]) !== 'undefined') {
                var li = document.createElement('li');
                var chain;
                if (i===this._messageQueue.length-1) {
                    $(li).fadeIn();
                }
                if (this._messageQueue[i].from === this._bopclient._router.id.toString() ||
                    this._messageQueue[i].from === this._bopclient.bopid) {
                    chain = 'OUT';
                    if (this._messageQueue[i].to) {
                        el.appendChild(li).innerHTML = '<a href="#message-inspector-container"> ' + chain + '>' + ' {type: ' + this._messageQueue[i].type + ', to: ' + this._messageQueue[i].to.substr(0,8) + '}' + '</a>';
                    } else {
                        el.appendChild(li).innerHTML = '<a href="#message-inspector-container"> ' + chain + '>' + ' {type: ' + this._messageQueue[i].type + ', to: ' + 'signalin' + '}' + '</a>';
                    }
                    li.className = 'message-inspector-out';
                } else if (this._messageQueue[i].to === this._bopclient._router.id.toString() || 
                    this._messageQueue[i].to === this._bopclient.bopid || this._messageQueue[i].to === '*') {
                    chain = 'IN';
                    el.appendChild(li).innerHTML = '<a href="#message-inspector-container"> ' + chain + '>' + ' {type: ' + this._messageQueue[i].type + ', from: ' + this._messageQueue[i].from.substr(0,8) + '}' + '</a>';
                    li.className = 'message-inspector-in';
                } else {
                    chain = 'FOR';
                    el.appendChild(li).innerHTML = '<a href="#message-inspector-container"> ' + chain + '>' + ' {type: ' + this._messageQueue[i].type + ', to: ' + this._messageQueue[i].to.substr(0,8) + '}' + '</a>';
                    li.className = 'message-inspector-forward';
                }
                
                createClickHandler(li, i);
            }
        }
        function createClickHandler(el, index) {
            $(el).click(function(){
                self.outputMessage($(this._pre), index);
            });
        }
    }
};
