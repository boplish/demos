Game = function(bopclient, bopcast) {
    if(!(this instanceof Game)) {
        return new Game(bopclient);
    }

    this._messageQueue = new Array(100);
    this._bopclient = bopclient;
    this._bopcast = bopcast;
    this._bopcast.addCallback(this._onMessage.bind(this));
    //this._players = [];
    this._position = {
        posx: 10,
        posy: 10
    };
    this._scale = 20;
    
    return this;
};

Game.prototype = {
    moveLeft: function() {
        this.move(this._position.posx-1, this._position.posy);
    },
    moveRight: function() {
        this.move(this._position.posx+1, this._position.posy);
    },
    moveUp: function() {
        this.move(this._position.posx, this._position.posy-1);
    },
    moveDown: function() {
        this.move(this._position.posx, this._position.posy+1);
    },
    move: function(posx, posy) {
        /*this._position = {
            posx: posx,
            posy: posy
        };*/
        this._bopcast.send({
            position: {
                posx: posx,
                posy: posy
            },
            type: 'game'
        });
    },
    _onMessage: function(msg, from) {
        if (msg.type !== 'game' ) {
            return;
        }
        this._position = msg.position;
        // console.log('new position ' + msg + ' from: ' + from);
    },
    _draw: function() {
        var canvas = document.getElementById('game-canvas');
        canvas.width = 55 * this._scale;
        canvas.height = 25 * this._scale;

        // draw ground layer
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // get player position and draw
        /*this._players.forEach(function(player) {
            ctx.fillStyle = '#FA5858'; //red
            console.log(player);
            ctx.fillRect(player.position.posx*this._scale, player.position.posy*this._scale, this._scale, this._scale);
        }.bind(this));*/
        ctx.fillStyle = '#FA5858'; //red
        ctx.fillRect(this._position.posx*this._scale, this._position.posy*this._scale, this._scale, this._scale);
        setTimeout(function(){
            this._draw();
        }.bind(this), 100);
    }
};