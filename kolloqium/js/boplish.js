(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*global navigator, document, console, window */

/**
 * @fileOverview
 * <p>
 * Adapter code for handling browser differences.
 * </p>
 * <p>
 * Original version retrieved from <a href="https://apprtc.appspot.com/js/adapter.js">https://apprtc.appspot.com/js/adapter.js</a>.
 * </p>
 */

RTCPeerConnection = null;
getUserMedia = null;
attachMediaStream = null;
reattachMediaStream = null;
webrtcDetectedBrowser = null;
webrtcDetectedVersion = null;

if (typeof(navigator) !== 'undefined' && navigator.mozGetUserMedia) {
    console.log("This appears to be Firefox");

    webrtcDetectedBrowser = "firefox";

    webrtcDetectedVersion =
        parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);

    // The RTCPeerConnection object.
    RTCPeerConnection = mozRTCPeerConnection;

    // The RTCSessionDescription object.
    RTCSessionDescription = mozRTCSessionDescription;

    // The RTCIceCandidate object.
    RTCIceCandidate = mozRTCIceCandidate;

    // Get UserMedia (only difference is the prefix).
    // Code from Adam Barth.
    getUserMedia = navigator.mozGetUserMedia.bind(navigator);

    // Creates iceServer from the url for FF.
    createIceServer = function(url, username, password) {
        var iceServer = null;
        var url_parts = url.split(':');
        if (url_parts[0].indexOf('stun') === 0) {
            // Create iceServer with stun url.
            iceServer = {
                'url': url
            };
        } else if (url_parts[0].indexOf('turn') === 0 &&
            (url.indexOf('transport=udp') !== -1 ||
                url.indexOf('?transport') === -1)) {
            // Create iceServer with turn url.
            // Ignore the transport parameter from TURN url.
            var turn_url_parts = url.split("?");
            iceServer = {
                'url': turn_url_parts[0],
                'credential': password,
                'username': username
            };
        }
        return iceServer;
    };

    // Attach a media stream to an element.
    attachMediaStream = function(element, stream) {
        console.log("Attaching media stream");
        element.mozSrcObject = stream;
        element.play();
    };

    reattachMediaStream = function(to, from) {
        console.log("Reattaching media stream");
        to.mozSrcObject = from.mozSrcObject;
        to.play();
    };

    // Fake get{Video,Audio}Tracks
    MediaStream.prototype.getVideoTracks = function() {
        return [];
    };

    MediaStream.prototype.getAudioTracks = function() {
        return [];
    };
} else if (typeof(navigator) !== 'undefined' && navigator.webkitGetUserMedia) {
    console.log("This appears to be Chrome");

    webrtcDetectedBrowser = "chrome";
    webrtcDetectedVersion =
        parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);

    // Creates iceServer from the url for Chrome.
    createIceServer = function(url, username, password) {
        var iceServer = null;
        var url_parts = url.split(':');
        if (url_parts[0].indexOf('stun') === 0) {
            // Create iceServer with stun url.
            iceServer = {
                'url': url
            };
        } else if (url_parts[0].indexOf('turn') === 0) {
            if (webrtcDetectedVersion < 28) {
                // For pre-M28 chrome versions use old TURN format.
                var url_turn_parts = url.split("turn:");
                iceServer = {
                    'url': 'turn:' + username + '@' + url_turn_parts[1],
                    'credential': password
                };
            } else {
                // For Chrome M28 & above use new TURN format.
                iceServer = {
                    'url': url,
                    'credential': password,
                    'username': username
                };
            }
        }
        return iceServer;
    };

    // The RTCPeerConnection object.
    RTCPeerConnection = webkitRTCPeerConnection;

    // Get UserMedia (only difference is the prefix).
    // Code from Adam Barth.
    getUserMedia = navigator.webkitGetUserMedia.bind(navigator);

    // Attach a media stream to an element.
    attachMediaStream = function(element, stream) {
        if (typeof element.srcObject !== 'undefined') {
            element.srcObject = stream;
        } else if (typeof element.mozSrcObject !== 'undefined') {
            element.mozSrcObject = stream;
        } else if (typeof element.src !== 'undefined') {
            element.src = URL.createObjectURL(stream);
        } else {
            console.log('Error attaching stream to element.');
        }
    };

    reattachMediaStream = function(to, from) {
        to.src = from.src;
    };

    // The representation of tracks in a stream is changed in M26.
    // Unify them for earlier Chrome versions in the coexisting period.
    if (!webkitMediaStream.prototype.getVideoTracks) {
        webkitMediaStream.prototype.getVideoTracks = function() {
            return this.videoTracks;
        };
        webkitMediaStream.prototype.getAudioTracks = function() {
            return this.audioTracks;
        };
    }

    // New syntax of getXXXStreams method in M26.
    if (!webkitRTCPeerConnection.prototype.getLocalStreams) {
        webkitRTCPeerConnection.prototype.getLocalStreams = function() {
            return this.localStreams;
        };
        webkitRTCPeerConnection.prototype.getRemoteStreams = function() {
            return this.remoteStreams;
        };
    }
} else {
    console.log("Browser does not appear to be WebRTC-capable");
}

},{}],2:[function(require,module,exports){
(function (process){
/** WIP */
/** @fileOverview API for application developers. */

var bowser = require('bowser');
var ConnectionManager = require('./connectionmanager.js');
var Router = require('./chord/chord.js');
var ChordNode = require('./chord/node.js');
var BigInteger = require('./third_party/BigInteger.js');
var BopURI = require('./bopuri.js');
var Scribe = require('./scribe.js');
var config = require('./config.js');
var bopclientConfig = config.bopclient;

/**
 * @constructor
 * @class This is the top-level API for BOPlish applications. It should be the
 * only interface used for interacting with the P2P network.
 * @param bootstrapHost {String} Name and port of the host running the signaling
 * server. The format is 'ws[s]://HOSTNAME[:PORT][/]'. If this is undefined or null then
 * the host of the serving application is used. Using the `wss` scheme for tls encrypted
 * communication to the `bootstrapHost` is highly recommended.
 * @param successCallback {BOPlishClient~onSuccessCallback} Called when a
 * connection to the P2P network has been established.
 * @param errorCallback {BOPlishClient~onErrorCallback} Called when a connection
 * to the P2P network could not be established (e.g. if the WebSocket connection
 * to the bootstrapHost failed.
 */

BOPlishClient = function(bootstrapHost, successCallback, errorCallback) {
    if (!(this instanceof BOPlishClient)) {
        return new BOPlishClient(bootstrapHost, successCallback, errorCallback);
    } else if (typeof(bootstrapHost) !== 'string' || typeof(successCallback) !== 'function' || typeof(errorCallback) !== 'function') {
        throw new TypeError('Not enough arguments or wrong type');
    }
    var self = this;

    // when join fails, retry after 5s
    self._joinDelay = bopclientConfig.joinDelay || 5000;
    // number of retries
    self._joinTrials = bopclientConfig.joinTrials || 3;

    var browser = bowser.browser;
    if (browser.firefox && browser.version >= 26) {
        // we are on FF
    } else if (browser.chrome && browser.version >= 33) {
        // we are on Chrome
    } else if (typeof(process) === 'object') {
        // we are on Node.js
    } else {
        errorCallback('You will not be able to use BOPlish as your browser is currently incompatible. Please use either Firefox 26 or Chrome 33 upwards.');
        return;
    }

    if (bootstrapHost.substring(bootstrapHost.length - 1, bootstrapHost.length) !== '/') { // add trailing slash if missing
        bootstrapHost += '/';
    }
    if (bootstrapHost.substring(0, 6) !== 'wss://' && bootstrapHost.substring(0, 5) !== 'ws://') { // check syntax
        errorCallback('Syntax error in bootstrapHost parameter');
        return;
    }
    var id = Router.randomId();
    var channel = new WebSocket(bootstrapHost + 'ws/' + id.toString());

    this.bopid = bopclientConfig.bopid || Math.random().toString(36).replace(/[^a-z]+/g, '') + '@id.com';

    channel.onerror = function(ev) {
        errorCallback('Failed to open connection to bootstrap server:' + bootstrapHost + ': ' + ev);
    };

    this._connectionManager = new ConnectionManager();
    this._router = new Router(id, channel, this._connectionManager);
    this._scribe = new Scribe(this._router);
    this._scribe.onmessage = this._onGroupMessage.bind(this);
    this._protocols = {};

    channel.onopen = function() {
        (function join() {
            self._connectionManager.bootstrap(self._router, _authBopId.bind(self), function(err) {
                if (--self._joinTrials >= 0) {
                    console.log('Join did not work: ', err);
                    setTimeout(join, self._joinDelay);
                } else {
                    this._router = null;
                    this._connectionManager = null;
                    errorCallback('Could not join the DHT, giving up: ' + err);
                }
            });
        })();
    };

    function _authBopId() {
        // creating a random bopid (for now) and store it in the dht
        var auth = {
            chordId: id.toString(),
            timestamp: new Date()
        };

        function errorHandler(err) {
            if (err) {
                errorCallback(err);
            }
        }
        this._router.put(this.bopid, auth, errorHandler);
        setInterval(function() {
            this._router.put(this.bopid, auth, errorHandler);
        }.bind(this), 2000);
        successCallback();
    }
};

BOPlishClient.prototype = {

    /**
     * Registers and returns an protocol-specific object that can be used by
     * application protocols to interact with the BOPlish sytem.
     * @param {String} A distinct name identifying the protocol to be registered
     * @return {Object} Object with `send` and `onmessage` properties that can be
     * used by application protocols
     */
    registerProtocol: function(protocolIdentifier) {
        var self = this;
        var protocol = {
            bopid: this.bopid,
            send: function(bopuri, msg, cb) {
                if (!msg) {
                    throw new Error('Trying to send empty message');
                }

                self._send(bopuri, protocolIdentifier, msg, cb);
            },
            group: {
                create: function(groupId, cb) {
                    var uri = BopURI.create(groupId, protocolIdentifier, '', '');
                    self._scribe.create(uri.toString(), cb);
                },
                leave: function(groupId, cb) {
                    var uri = BopURI.create(groupId, protocolIdentifier, '', '');
                    self._scribe.leave(uri.toString(), cb);
                },
                subscribe: function(groupId, cb) {
                    var uri = BopURI.create(groupId, protocolIdentifier, '', '');
                    self._scribe.subscribe(uri.toString(), cb);
                },
                publish: function(groupId, msg, cb) {
                    var uri = BopURI.create(groupId, protocolIdentifier, '', '');
                    self._scribe.publish(uri.toString(), msg, cb);
                },
                getSubscriptions: function() {
                    var groups = self._scribe.getMySubscriptions();
                    var mySubscriptions = [];
                    groups.forEach(function(item) {
                        var uri = new BopURI(item);
                        if (uri.protocol === protocolIdentifier) {
                            mySubscriptions.push(uri.uid);
                        }
                    });
                    return mySubscriptions;
                }
            }
        };
        this._router.registerDeliveryCallback(protocolIdentifier, function(msg) {
            if (typeof protocol.onmessage === "function") {
                protocol.onmessage(msg.from, msg.payload);
            }
        });
        this._protocols[protocolIdentifier] = protocol;
        return protocol;
    },

    _onGroupMessage: function(to, msg) {
        var uri = new BopURI(to);
        if (this._protocols[uri.protocol]) {
            if (typeof this._protocols[uri.protocol].group.onmessage === 'function') {
                this._protocols[uri.protocol].group.onmessage(uri.uid, msg);
            }
        }
    },

    /**
     * todo
     *
     */
    _send: function(bopid, protocolIdentifier, msg, cb) {
        msg = {
            payload: msg,
            to: bopid,
            from: this.bopid,
            type: protocolIdentifier
        };

        this._router.get(bopid, function(err, auth) {
            if (err) {
                console.log("Error resolving " + bopid, err);
                if (typeof cb === 'function') {
                    cb(err);
                }
            } else if (auth && auth.chordId) {
                this._router.route(new BigInteger(auth.chordId), msg, function(err) {
                    if (err) {
                        console.log("Error routing message to " + auth.chordId, err);
                    }
                    if (typeof cb === 'function') {
                        cb(err);
                    }
                });
            } else if (typeof cb === 'function') {
                cb(new Error('Malformed response from GET request for ' + bopid + '. Returned ' + JSON.stringify(auth)));
            }
        }.bind(this));
    },

    _get: function(hashString, cb) {
        this._router.get(hashString, cb);
    },

    _put: function(hashString, value, cb) {
        this._router.put(hashString, value, cb);
    },

    /**
     * Installs a special callback that receives all messages despite their
     * protocol.
     * @param callback {BOPlishClient~monitorCallback} Invoked on reception of a
     * message.
     */
    setMonitorCallback: function(callback) {
        this._router.registerMonitorCallback(callback);
    },

    /**
     * @return {Array} The list of all IDs of peers this peer has an open
     * connection to.
     */
    getConnectedPeers: function() {
        return this._router.getPeerIds();
    }
};

BOPlishClient.BopURI = BopURI;
BOPlishClient.config = config;
BOPlishClient.setRTTEstimator = function(estimator) {
    console.log("setting estimator to ", estimator);
    ChordNode.RTTestimator = estimator;
};

if (typeof(module) !== 'undefined') {
    module.exports = BOPlishClient;
}

}).call(this,require("FWaASH"))
},{"./bopuri.js":3,"./chord/chord.js":5,"./chord/node.js":6,"./config.js":9,"./connectionmanager.js":10,"./scribe.js":14,"./third_party/BigInteger.js":15,"FWaASH":19,"bowser":18}],3:[function(require,module,exports){
/** @fileOverview URI parsing functionality for BOPlish URIs */

/**
 * @constructor
 * @class BOPlish URI class. Parses BOPlish URIs and allows access to the
 * different components.
 *
 * @param str the URI string to parse
 */
var BopURI = function(str) {

    if (!(this instanceof BopURI)) {
        return new BopURI(str);
    }

    var pathSepIdx = str.indexOf('/');
    var prefix = str.slice(0, pathSepIdx);

    var prefixArr = prefix.split(":");
    this.scheme = prefixArr[0];
    if (this.scheme !== 'bop') {
        throw new Error('Tried to create URI with unknown scheme: ' + str);
    }
    this.uid = prefixArr[1];
    this.protocol = prefixArr[2];

    if (pathSepIdx != -1) {
        var suffix = str.slice(pathSepIdx);
        var querySepIdx = suffix.indexOf('?');
        if (querySepIdx == -1) {
            this.path = suffix;
        } else {
            this.path = suffix.slice(0, querySepIdx);
            this.query = suffix.slice(querySepIdx + 1);
        }
    }
    if (this.scheme === undefined || this.uid === undefined || this.protocol === undefined) {
        throw new Error('Tried to create URI from wrongly formatted string');
    }

    return this;
};

BopURI.create = function(authority, protocol, path, query) {
    return new BopURI('bop:' + authority + ':' + protocol + "/" + (path[0] === '/' ? path.substr(1) : path) + (query ? '?' + query : ''));
};

BopURI.prototype = {
    toString: function() {
        return this.scheme + ":" + this.uid + ":" + this.protocol + this.path + (this.query ? "?" + this.query : "");
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = BopURI;
}

},{}],4:[function(require,module,exports){
var peerConfig = require('../config.js').peer;
var RingBuffer = require("../ringbuffer.js");
var ChordNode = require('./node.js');

var RTTestimator = function() {
    this._RTO = peerConfig.messageTimeout || 1000;
    this._history = new RingBuffer(10);
    this.maxRTT = -1;
};

RTTestimator.prototype = {
    /**
     * Feeds a new calculated RTT value into the estimator for further
     * processing.
     */
    newRTT: function(rtt) {
        this._history.push(rtt);
        if (rtt > this.maxRTT) {
            this.maxRTT = rtt;
        }
        var histArr = this._history.getall();
        this._RTO = histArr.reduce(function(prev, cur) {
            return prev + cur;
        }, 0) / histArr.length;
    },

    /**
     * Retrieves the current calculated RTO.
     */
    rto: function() {
        return this._RTO;
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = RTTestimator;
}

},{"../config.js":9,"../ringbuffer.js":12,"./node.js":6}],5:[function(require,module,exports){
var ChordNode = require('./node.js');
var Peer = require('../peer.js');
var Sha1 = require('../third_party/sha1.js');
var BigInteger = require('../third_party/BigInteger.js');
var async = require("async");
var Range = require("./range.js");
var chordConfig = require('../config.js').chord;

/** @fileOverview Chord DHT implementation */

/**
 * @constructor
 * @class This is a Chord DHT implementation using WebRTC data channels.
 *
 * @param id {BigInteger} the ID of this Chord instance
 * @param fallbackSignaling {WebSocket} The fallback channel to the bootstrap
 * server
 * @param connectionManager {ConnectionManager} The connection manager instance
 * to be used for requesting data channel connections.
 */
var Chord = function(id, fallbackSignaling, connectionManager) {
    if (!(this instanceof Chord)) {
        return new Chord(id, fallbackSignaling, connectionManager);
    }

    if (typeof(chordConfig.maxFingerTableEntries) !== 'undefined' && (chordConfig.maxFingerTableEntries < 1 || chordConfig.maxFingerTableEntries > 160)) {
        throw new Error("Illegal maxFingerTableEntries value: " + maxFingerTableEntries + ". Must be between 1 and 160 (inclusively).");
    }

    Helper.defineProperties(this);

    this._m = m();

    if (!id) {
        id = Chord.randomId();
    }

    this._localNode = new ChordNode(new Peer(id, null, fallbackSignaling), this, true);
    this._localNode._successor = this._localNode;
    this._localNode._predecessor = null;
    this._remotes = {};
    this._connectionManager = connectionManager;
    this._messageCallbacks = {};
    this._monitorCallback = function() {};
    this._fingerTable = {};
    this._maxPeerConnections = chordConfig.maxPeerConnections || 15;
    this._joining = false;
    this.debug = chordConfig.debug || false;
    this._successorList = [];
    this._routeInterceptor = [];
    this._helper = Helper;

    var memoizer = Helper.memoize(Helper.fingerTableIntervalStart.bind(this));
    for (var i = 1; i <= this._m; i++) {
        this._fingerTable[i] = {
            i: i,
            start: memoizer.bind(null, i),
            node: this._localNode
        };
    }

    this._stabilizeInterval = chordConfig.stabilizeInterval || 1000;
    this._stabilizeTimer = setTimeout(this.stabilize.bind(this), this._stabilizeInterval);
    this._fixFingersInterval = chordConfig.fixFingersInterval || 1000;
    this._fixFingersTimer = setTimeout(this._fix_fingers.bind(this), this._fixFingersInterval);

    return this;
};

/**
 * Returns the configured value of m (number of bits in key IDs) or the default.
 */

function m() {
    return chordConfig.maxFingerTableEntries || 16;
}

/**
 * Internal Helper Functions
 **/

var Helper = {
    memoize: function(func) {
        var memo = {};
        var slice = Array.prototype.slice;
        return function() {
            var args = slice.call(arguments);
            if (!(args in memo)) {
                memo[args] = func.apply(this, args);
            }
            return memo[args];
        };
    },

    fingerTableIntervalStart: function(k) {
        return this.id.add(BigInteger(2).pow(k - 1)).mod(BigInteger(2).pow(this._m));
    },

    defineProperties: function(object) {
        Object.defineProperty(object, "connectionManager", {
            set: function(cm) {
                object._connectionManager = cm;
            }
        });
        Object.defineProperty(object, "id", {
            get: function() {
                return object._localNode.id.bind(object._localNode)();
            },
            set: function(id) {}
        });
    },

    random: function(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    },

    randomFingerTableIndex: function(table) {
        var keys = Object.keys(table);
        return keys[Helper.random(0, keys.length - 1)];
    }
};

Chord.prototype._closest_preceding_finger = function(id) {
    var i;
    for (i = this._m; i >= 1; i--) {
        if (this._fingerTable[i] && this._fingerTable[i].node !== this._localNode && Range.inOpenInterval(this._fingerTable[i].node.id(), this.id, id)) {
            return this._fingerTable[i].node;
        }
    }
    return this._localNode;
};

Chord.prototype._fix_fingers = function() {
    var self = this;
    var i = Helper.randomFingerTableIndex(self._fingerTable),
        start;
    start = self._fingerTable[i].start();

    self.find_successor(start, function(err, msg) {
        if (err) {
            console.log('Error during fix_fingers:', err);
        } else if (msg.successor.equals(self.id)) {
            // we are the successor
            self._fingerTable[i].node = self._localNode;
        } else {
            // connect to new successor
            self.connect(msg.successor, function(err, node) {
                if (err) {
                    return console.log('Error during fix_fingers:', err);
                }
                node._peer.sendHeartbeat(function(err, msg) {
                    if (err) {
                        self._fingerTable[i].node = self._localNode;
                    } else {
                        self._fingerTable[i].node = node;
                    }
                });
            });
        }
    });

    self._fixFingersTimer = setTimeout(self._fix_fingers.bind(self), self._fixFingersInterval);
};

Chord.prototype.getFingerTable = function() {
    var fingers = [];
    for (var i in this._fingerTable) {
        fingers.push({
            k: this._fingerTable[i].k,
            start: this._fingerTable[i].start().toString(),
            successor: this._fingerTable[i].node.id().toString()
        });
    }
    return fingers;
};

Chord.prototype.log = function(msg) {
    if (!this.debug) {
        return;
    }
    var prelude = "[" + this._localNode._peer.id.toString() + "]";
    if (arguments.length > 1) {
        console.log([prelude, msg].concat(Array.prototype.slice.call(arguments, 1)).join(" "));
    } else {
        console.log([prelude, msg].join(" "));
    }
};

/**
 * join the DHT by using the 'bootstrap' node
 *
 * @param bootstrapPeer {Peer} Peer instance of the bootstrap host
 * @param successCallback {Chord~joinCallback} called after the join operation has been
 * carried out successfully.
 */
Chord.prototype.join = function(bootstrapPeer, callback) {
    var i, self = this;
    if (self._joining) {
        callback("Already joining");
        return;
    }
    self._joining = true;

    self.addPeer(bootstrapPeer, function(err, bootstrapNode) {
        if (err) {
            self._joining = false;
            callback("Could not add the bootstrap peer: " + err);
            return;
        }
        self.log("My bootstrap peer is " + bootstrapNode.id().toString());
        bootstrapNode.find_predecessor(self.id.plus(1), function(err, res) {
            if (err) {
                self._joining = false;
                callback("Could not find a successor: " + err);
                return;
            }
            self.log("My successor is " + res.successor.toString());
            self.connect(res.successor, function(err, successorNode) {
                if (err) {
                    self._joining = false;
                    callback("The proposed successor was not reachable: " + err);
                    return;
                } else {
                    self._localNode._successor = successorNode;
                    self._joining = false;
                    console.log('JOINED');
                    callback(null);
                }
            });
        });
    });
};

Chord.prototype.updateSuccessorList = function(cb) {
    var self = this;
    var newSuccessorList = [];
    // fill up successorList with the next two peers behind successor (if it's not me)
    self._localNode._successor.find_predecessor(self._localNode.successor_id().plus(1), function(err, res) {
        if (!err && !res.successor.equals(self.id)) {
            newSuccessorList.push(res.successor);
            self._successorList = newSuccessorList;
            self._localNode._successor.find_predecessor(res.successor.plus(1), function(err, res) {
                if (!err && !res.successor.equals(self.id)) {
                    newSuccessorList.push(res.successor);
                    self._successorList = newSuccessorList;
                    cb(null, self._successorList);
                } else {
                    cb(err);
                }
            });
        } else {
            cb(err);
        }
    });
};

Chord.prototype._addRemote = function(node) {
    this._remotes[node.id()] = node;
};

Chord.prototype.find_successor = function(id, callback) {
    this.find_predecessor(id, callback);
};

Chord.prototype.find_predecessor = function(id, callback) {
    var self = this;

    if (Range.inRightClosedInterval(id, self.id, self._localNode.successor_id())) {
        callback(null, {
            predecessor: self.id,
            successor: self._localNode.successor_id()
        });
    } else if (self._localNode.responsible(id)) {
        callback(null, {
            predecessor: self._localNode.predecessor_id(),
            successor: self.id
        });
    } else if (self.id.equals(self._localNode.successor_id())) {
        // inconsistent successor pointer, cannot answer this correctly
        // maybe i am the only one in the ring
        callback(null, {
            successor: self.id,
            predecessor: self.id
        });
    } else {
        var nextHop = self._closest_preceding_finger(id);
        if (nextHop.id().equals(self.id)) {
            nextHop = self._localNode._successor;
        }
        nextHop.find_predecessor(id, callback);
    }
};

Chord.prototype.connect = function(id, callback) {
    var self = this;
    if (id.equals(self.id)) {
        callback('cannot connect to myself');
        return;
    }
    if (this._remotes[id]) {
        callback(null, this._remotes[id]);
    } else {
        this._connectionManager.connect(id, function(err, peer) {
            if (err) {
                callback(err);
                return;
            }
            self._addRemote(new ChordNode(peer, self, false));
            callback(null, self._remotes[id]);
        });
    }
};

/**
 * Add a peer to the list of remotes.
 *
 * @param peer {Peer} Peer to add
 * @param callback {Function} called after the peer has been added. returns
 */
Chord.prototype.addPeer = function(peer, callback) {
    // keep length of remotes low, if bigger than x, delete one if its not succ or pre
    if (this._remotes.length >= this._maxPeerConnections) {
        var keys = Obect.keys(this._remotes);
        var node = this._remotes[keys[keys.length * Math.random() << 0]];
        if (!node.equals(this._localNode._successor) && !node.equals(this._localNode._predecessor)) {
            node._peer._peerConnection.close();
            delete this._remotes[node];
        }
    }
    this._remotes[peer.id.toString()] = new ChordNode(peer, this, false);
    // TODO: what if we already have a node with this ID?
    callback(null, this._remotes[peer.id.toString()]);
};

Chord.prototype.removePeer = function(peer) {
    delete this._remotes[peer.id()];
};

Chord.prototype.stabilize = function() {
    var self = this;

    // dont run stabilize when we are currently joining
    if (self._joining) {
        self._stabilizeTimer = setTimeout(this.stabilize.bind(this), this._stabilizeInterval);
        return;
    }
    self._stabilizeTimer = clearTimeout(self._stabilizeTimer);

    // check if pre is still up if it's not unset
    if (!self._localNode.predecessor_id().equals(self.id)) {
        self._localNode._predecessor._peer.sendHeartbeat(function(err) {
            if (err) {
                self.log('predecessor down - removed it');
                // just remove it if its gone, someone else will update ours
                self._localNode._predecessor = null;
            }
        });
    }

    // check if successor is still up if it's not me and update succesor list
    if (!self._localNode.successor_id().equals(self.id)) {
        self._localNode._successor._peer.sendHeartbeat(function(err) {
            if (!!err && self._successorList.length <= 0) {
                self.log('successor failed, cannot recover. RESETTING');
                // @todo: we might be able to recover using a node in `self._remotes`
                // @todo: do we have to cleanup the remotes?
                self._remotes = {};
                self._localNode._successor = self._localNode;
                self._localNode._predecessor = null;
                self.stabilize();
                return;
            } else if (!!err && self._successorList.length > 0) {
                // successor failed, we can recover using the successor list
                var new_suc_id = self._successorList[Math.floor(Math.random() * self._successorList.length)];
                self.log('successor down, trying to recover using', new_suc_id.toString());
                self.connect(new_suc_id, function(err, newSuccessorNode) {
                    if (!err) {
                        self.log('yai, we got us a new successor');
                        self._localNode._successor = newSuccessorNode;
                    } else {
                        self.log('successor in successorList is down');
                    }
                    // remove the id from successorList as it either failed or is our successor now
                    var index = self._successorList.indexOf(new_suc_id);
                    var proposedSuccessorId = self._successorList.splice(index, 1);
                    self.log('removed proposed successor from successorList:', proposedSuccessorId.toString());
                    self._stabilizeTimer = setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
                });
            } else {
                // successor is up, check if someone smuggled in between (id, successor_id]
                // or if successor.predecessor == successor (special case when predecessor is unknown)
                self._localNode._successor.find_predecessor(self._localNode.successor_id(), function(err, res) {
                    if (!err && Range.inOpenInterval(res.predecessor, self.id, self._localNode.successor_id())) {
                        self.log('we have a successor in (myId, sucId), it becomes our new successor');
                        self.connect(res.predecessor, function(err, suc_pre_node) {
                            if (!err) {
                                self._localNode._successor = suc_pre_node;
                            }
                            self._stabilizeTimer = setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
                        });
                    } else if (!err) {
                        self.log('nobody smuggled in - everything is superb');
                        self._stabilizeTimer = setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
                    } else {
                        self.log(err);
                        self._stabilizeTimer = setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
                    }
                });
                // update successor list if everything is allright
                self.updateSuccessorList(function() {});
                // notify our successor of us
                self._localNode._successor.notify(self.id, function() {});
            }
        });
    } else {
        // i am my own successor. this only happens when reconnecting using 
        // the successor_list failed. In this case, pick a remote to re-join the DHT
        var remoteIds = self.getPeerIds();
        if (remoteIds.length >= 1) {
            var bootstrapNodeId = remoteIds[Math.floor(Math.random() * remoteIds.length)];
            var bootstrapNode = self._remotes[bootstrapNodeId];
            self.log('Attempting RE-JOIN using random peer from _remotes: ' + bootstrapNode.id().toString());
            self.join(bootstrapNode._peer, function(err) {
                if (err) {
                    self.log('RE-JOIN failed:', err);
                } else {
                    self.log('RE-JOIN successful');
                }
            });
        } else {
            self.log('Waiting for somebody to join me');
        }
        self._stabilizeTimer = setTimeout(self.stabilize.bind(self), self._stabilizeInterval);
    }
};

Chord.prototype._validateKey = function(key) {
    if (key.lesser(0) || key.greater(BigInteger(2).pow(this._m).minus(1))) {
        throw new Error("Key " + key.toString() + " not in acceptable range");
    }
};

/**
 * Store 'value' under 'key' in the DHT.
 *
 * @param key {String} or {BigInteger}. If key is a string, the SHA1 sum is
 * calculated from key and a valid ID created.
 * @param value
 */
Chord.prototype.put = function(key, value, callback) {
    if (typeof key === 'string') {
        key = Sha1.bigIntHash(key).mod(BigInteger(2).pow(this._m));
    } else {
        this._validateKey(key);
    }
    if (this._localNode.responsible(key)) {
        this._localNode.store(key, value);
        callback(null);
    } else {
        this._localNode._successor.put(key, value, callback);
    }
};

/**
 * Retrieve a value stored under 'key' in the DHT.
 *
 * @param key {String} or {BigInteger}. If key is a string, the SHA1 sum is
 * calculated from key and a valid ID created.
 */
Chord.prototype.get = function(key, callback) {
    if (typeof key === 'string') {
        key = Sha1.bigIntHash(key).mod(BigInteger(2).pow(this._m));
    }
    this._validateKey(key);
    var val;
    if (this._localNode.responsible(key)) {
        val = this._localNode.get_from_store(key);
        callback(null, val);
    } else {
        this._localNode._successor.get(key, callback);
    }
};

Chord.prototype.remove = function(key) {
    if (typeof key === 'string') {
        key = Sha1.bigIntHash(key).mod(BigInteger(2).pow(this._m));
    }
    this._validateKey(key);
    // TODO: implement
};

Chord.prototype.route = function(to, message, callback, options) {
    var self = this;
    var chordMsg = {
        to: to,
        payload: message
    };
    // default reliability service is reliable
    if (!options || options.reliable === undefined) {
        options = {
            reliable: true
        };
    }

    // make sure we run all interceptors before continuing
    var i = 0;
    (function callRouteInterceptor() {
        if (typeof(self._routeInterceptor[i]) === 'function') {
            self._routeInterceptor[i](chordMsg, function(err, _chordMsg, drop) {
                if (err) {
                    if (options.reliable) {
                        callback('Error from RouteInterceptor: ' + err);
                    }
                    return;
                } else if (!!drop) {
                    self.log('RouteInterceptor dropped message', JSON.stringify(_chordMsg));
                    if (options.reliable) {
                        callback(null);
                    }
                    return;
                }
                chordMsg = _chordMsg;
                i++;
                callRouteInterceptor();
            });
        } else {
            route(chordMsg.to, chordMsg.payload, callback, options);
        }
    })();

    function route(to, message, callback, options) {
        self._monitorCallback(message);
        if (to === "*" || (message.type === 'signaling-protocol' && !to.equals(self.id))) {
            // outgoing signaling messages go to bootstrap server
            self.log("routing (" + [message.type, message.seqnr].join(", ") + ") to signaling server");
            self._localNode.route(to, message, options, callback);
        } else if (self._localNode.responsible(to)) {
            try {
                self.log("(" + [message.type, message.seqnr].join(", ") + ") is for me");
                self._messageCallbacks[message.type](message);
                if (options.reliable) {
                    callback(null);
                }
            } catch (e) {
                self.log("Error handling message: ", e);
                if (options.reliable) {
                    callback("Error handling message: " + e);
                }
            }
        } else {
            // route using finger table
            var nextHop = self._closest_preceding_finger(to);
            if (nextHop === self._localNode) {
                // finger table is intialy filled with localnode, make sure not to route to myself
                if (nextHop.id().equals(self._localNode.successor_id())) {
                    // we do not know our successor, drop message and error out
                    if (options.reliable) {
                        callback('Could not route message');
                    }
                    return;
                } else {
                    nextHop = self._localNode._successor;
                }
            }
            self.log("routing (" + [message.type, message.payload.type, message.seqnr].join(", ") + ") to " + nextHop.id().toString());
            nextHop.route(to, message, options, callback);
        }
    }
};

Chord.prototype.registerDeliveryCallback = function(protocol, callback) {
    this._messageCallbacks[protocol] = callback;
};

Chord.prototype.registerInterceptor = function(interceptor) {
    this._routeInterceptor.push(interceptor);
};

Chord.prototype.registerMonitorCallback = function(callback) {
    this._monitorCallback = callback;
};

/**
 * Return a list of all peer ids currently in the routing table.
 *
 * @returns {Array}
 */
Chord.prototype.getPeerIds = function() {
    var peers = [];
    var peer;
    for (peer in this._remotes) {
        if (this._remotes.hasOwnProperty(peer)) {
            peers.push(peer);
        }
    }
    return peers;
};

Chord.randomId = function() {
    var randomId = Sha1.bigIntHash(Math.random().toString());
    return randomId.mod(BigInteger(2).pow(BigInteger(m())));
};

if (typeof(module) !== 'undefined') {
    module.exports = Chord;
}

/**
 * Invoked after the node has joined the DHT.
 * @callback Chord~joinCallback
 * @param id {Number} This node's Chord ID.
 */

/**
 * Invoked after a Peer has been added to the Router.
 * @callback Chord~addPeerCallback
 * @param err {String} An error message if something went wrong
 * @param node {ChordNode} Node instance that was added to `_remotes`
 */

},{"../config.js":9,"../peer.js":11,"../third_party/BigInteger.js":15,"../third_party/sha1.js":16,"./node.js":6,"./range.js":7,"async":17}],6:[function(require,module,exports){
var BigInteger = require("../third_party/BigInteger.js");
var Range = require("./range.js");
var RTTEstimator = require('./staticrttestimator.js');

var ChordNode = function(peer, chord, localNode) {
    if (!(this instanceof ChordNode)) {
        return new ChordNode(peer, chord, localNode);
    }

    if (typeof peer === "undefined") {
        throw new Error("Trying to instantiate a ChordNode without a Peer");
    }

    this._peer = peer;
    this._peer.onmessage = this._onmessage.bind(this);
    this._successor = null;
    this._predecessor = null;
    this._chord = chord;
    this._pending = {};
    this._seqnr = 0;
    this.debug = false;
    this._localNode = !!localNode;
    this._store = {};
    this._rttEstimator = new ChordNode.RTTestimator();

    return this;
};

ChordNode.RTTestimator = RTTEstimator;

ChordNode.message_types = {
    FIND_SUCCESSOR: "FIND_SUCCESSOR",
    FIND_PREDECESSOR: "FIND_PREDECESSOR",
    PREDECESSOR: "PREDECESSOR",
    NOTIFY: "NOTIFY",
    ACK: "ACK",
    PUT: "PUT",
    GET: "GET",
    ROUTE: "ROUTE",
    ERROR: "ERROR"
};

ChordNode.prototype = {

    /**
     * Public API
     **/

    toString: function() {
        var succ_id = this.successor_id();
        var pred_id = this.predecessor_id();
        return "[" + this.id() + "," + (succ_id ? succ_id.toString() : "") + "," + (pred_id ? pred_id.toString() : "") + "]";
    },

    id: function() {
        return this._peer.id;
    },

    predecessor_id: function() {
        if (this._predecessor === null) {
            return this.id();
        }
        if (this._predecessor instanceof ChordNode) {
            return this._predecessor._peer.id;
        } else {
            throw new Error("Predecessor is not a ChordNode");
        }
    },

    successor_id: function() {
        if (this._successor === null) {
            return this.id();
        }
        if (this._successor instanceof ChordNode) {
            return this._successor._peer.id;
        } else {
            throw new Error("Successor is not a ChordNode");
        }
    },

    find_predecessor: function(id, cb) {
        var self = this;
        this._send_request({
            type: ChordNode.message_types.FIND_PREDECESSOR,
            id: id.toString()
        }, function(err, msg) {
            if (!err && msg && msg.res && msg.res.predecessor && msg.res.successor) {
                cb(null, {
                    successor: new BigInteger(msg.res.successor),
                    predecessor: new BigInteger(msg.res.predecessor)
                });
            } else {
                cb('Find predecessor failed: ' + err, null);
            }
        });
    },

    notify: function(id, cb) {
        var self = this;
        this._send_request({
            type: ChordNode.message_types.NOTIFY,
            id: id.toString()
        }, function(err, msg) {
            cb(null, null);
        });
    },

    responsible: function(id) {
        // I'm responsible for (predecessorId, myId]
        // if predecessorId==null i'm not sure
        // as inRightClosedInterval() returns false in that case
        // @todo: what do we do if predecessorId is currently not set or set to our id? 
        if (this.predecessor_id().equals(this.id())) {
            return true;
        } else {
            return id.equals(this.id()) || Range.inRightClosedInterval(id, this.predecessor_id(), this.id());
        }
    },

    put: function(key, value, callback) {
        this._send_request({
            type: ChordNode.message_types.PUT,
            key: key.toString(),
            value: value
        }, function(err, msg) {
            callback(null, null);
        });
    },

    get: function(key, callback) {
        var self = this;
        self.log("sending GET request");
        this._send_request({
            type: ChordNode.message_types.GET,
            key: key.toString()
        }, function(err, msg) {
            callback(null, msg.value);
        });
    },

    route: function(to, message, options, callback) {
        var self = this;
        if (!options || options.reliable === undefined) {
            throw new Error("Wrong options: " + options);
        }
        var routeMsg = {
            type: ChordNode.message_types.ROUTE,
            to: to.toString(),
            payload: message,
            options: options
        };
        if (options.reliable !== false) {
            this._send_request(routeMsg, function(err, msg) {
                callback(err);
            });
        } else {
            this._send_request_unreliably(routeMsg);
        }
    },

    store: function(key, value) {
        this._store[key] = value;
    },

    get_from_store: function(key) {
        return this._store[key];
    },

    /**
     * Internal API
     **/

    log: function(msg) {
        if (!this.debug) {
            return;
        }
        var prelude = "[" + this._peer.id.toString() + "," + this._chord._localNode._peer.id.toString() + "," + this._localNode + "] ";
        if (arguments.length > 1) {
            console.log([prelude, msg].concat(Array.prototype.slice.call(arguments, 1)).join(" "));
        } else {
            console.log([prelude, msg].join(" "));
        }
    },

    _find_predecessor: function(id, seqnr) {
        var self = this;
        this._chord.find_predecessor(id, function(err, res) {
            if (!err) {
                var msg = {
                    type: ChordNode.message_types.PREDECESSOR,
                    res: {
                        successor: res.successor.toString(),
                        predecessor: res.predecessor.toString()
                    },
                    seqnr: seqnr
                };
                self._send(msg);
            } else {
                var errorMsg = {
                    type: ChordNode.message_types.ERROR,
                    error: err,
                    seqnr: seqnr
                };
                self._send(errorMsg);
            }
        });
    },

    _notify: function(proposedId, seqnr) {
        var self = this;

        var myId = self._chord._localNode.id();
        var preId = self._chord._localNode.predecessor_id();

        if (proposedId.equals(preId)) {
            self.log('not updating my predecessor');
        } else if (preId.equals(myId) || Range.inLeftClosedInterval(proposedId, preId, myId)) {
            self.log('updating my predecessor to ' + proposedId.toString());
            // we got an id with a new predecessor. connect to it now 
            self._chord.connect(proposedId, function(err, chordNode) {
                self._chord._localNode._predecessor = chordNode;
            });
        } else {
            self.log('not updating my predecessor');
        }
        self._send({
            type: ChordNode.message_types.ACK,
            seqnr: seqnr
        });
    },

    _put: function(key, value, seqnr) {
        var self = this;
        this._chord.put(key, value, function(err) {
            var msg = {
                type: ChordNode.message_types.ACK,
                seqnr: seqnr
            };
            self._send(msg);
        });
    },

    _get: function(key, seqnr) {
        var self = this;
        this._chord.get(key, function(err, value) {
            var msg = {
                type: ChordNode.message_types.ACK,
                value: value,
                seqnr: seqnr
            };
            self._send(msg);
        });
    },

    _route: function(msg) {
        var self = this;
        this._chord.route(new BigInteger(msg.to), msg.payload, function(err) {
            // this callback is only invoked for reliable messages
            var resp = {
                type: ChordNode.message_types.ACK,
                seqnr: msg.seqnr,
                to: msg.from
            };
            if (err) {
                resp.type = ChordNode.message_types.ERROR;
                resp.error = err;
            }
            self._send(resp);
        }, msg.options);
    },

    _send_request: function(msg, cb) {
        msg.seqnr = Math.floor(Math.random() * 4294967296);
        this._pending[msg.seqnr] = {
            txTime: new Date(),
            callback: cb
        };
        setTimeout(function() {
            if (this._pending[msg.seqnr]) {
                msg.error = 'Timed out';
                this._handle_response(msg, this._pending[msg.seqnr]);
            }
        }.bind(this), this._rttEstimator.rto());
        this._send(msg);
    },

    _send_request_unreliably: function(msg) {
        this._send(msg);
    },

    _send: function(msg) {
        msg.from = this._chord.id.toString();
        try {
            this._peer.send(msg);
        } catch (e) {
            this.log("Error sending", e);
            throw new Error(e);
        }
    },

    _onmessage: function(msg) {
        var pending = this._pending[msg.seqnr];
        // if we find a callback this message is a response to a request of ours
        if (pending && typeof(pending.callback) === 'function') {
            this._handle_response(msg, pending);
        } else {
            this._handle_request(msg);
        }
    },

    _handle_response: function(msg, pending) {
        this._rttEstimator.newRTT(new Date() - pending.txTime);
        delete this._pending[msg.seqnr];
        pending.callback(msg.error, msg);
    },

    _handle_request: function(msg) {
        var key;
        if (msg.options && msg.options.reliable && typeof(msg.seqnr) === "undefined") {
            return; // ignore reliable message without sequence number
        }
        switch (msg.type) {
            case ChordNode.message_types.ROUTE:
                this._route(msg);
                break;
            case ChordNode.message_types.GET:
                key = new BigInteger(msg.key);
                this._get(key, msg.seqnr);
                break;
            case ChordNode.message_types.PUT:
                key = new BigInteger(msg.key);
                this._put(key, msg.value, msg.seqnr);
                break;
            case ChordNode.message_types.FIND_SUCCESSOR:
                var i = new BigInteger(msg.id);
                this._find_successor(i, msg.seqnr);
                break;
            case ChordNode.message_types.FIND_PREDECESSOR:
                this._find_predecessor(new BigInteger(msg.id), msg.seqnr);
                break;
            case ChordNode.message_types.NOTIFY:
                this._notify(new BigInteger(msg.id), msg.seqnr);
                break;
            default:
                //unknown request
                break;
        }
    },

};

if (typeof(module) !== 'undefined') {
    module.exports = ChordNode;
}

},{"../third_party/BigInteger.js":15,"./range.js":7,"./staticrttestimator.js":8}],7:[function(require,module,exports){
var Range = {
    /**
     * [start, end)
     */
    inLeftClosedInterval: function(val, start, end) {
        if (start.lesserOrEquals(end)) {
            return val.greaterOrEquals(start) && val.lesser(end);
        } else {
            return val.greaterOrEquals(start) || val.lesser(end);
        }
    },

    /**
     * (start, end]
     */
    inRightClosedInterval: function(val, start, end) {
        if (start.lesserOrEquals(end)) {
            return val.greater(start) && val.lesserOrEquals(end);
        } else {
            return val.greater(start) || val.lesserOrEquals(end);
        }
    },

    /**
     * (start, end)
     */
    inOpenInterval: function(val, start, end) {
        if (start.lesser(end)) {
            return val.greater(start) && val.lesser(end);
        } else {
            return val.greater(start) || val.lesser(end);
        }
    }
};

module.exports = Range;

},{}],8:[function(require,module,exports){
var peerConfig = require('../config.js').peer;
var RingBuffer = require("../ringbuffer.js");
var ChordNode = require('./node.js');

var StaticRTTestimator = function() {
    this._RTO = peerConfig.messageTimeout || 1000;
};

StaticRTTestimator.prototype = {
    newRTT: function(rtt) {
        // don't care
    },

    rto: function() {
        return this._RTO;
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = StaticRTTestimator;
}

},{"../config.js":9,"../ringbuffer.js":12,"./node.js":6}],9:[function(require,module,exports){
var config = {
    peer: {
        // messageTimeout: 1000
    },
    connectionManager: {
        // pcoptions: { iceServers: [{
        //              "url": "stun:stun.l.google.com:19302"
        // }]},
        // dcoptions: {}
    },
    chord: {
        debug: false,
        // debug: false,
        // maxPeerConnections: 15,
        // maxFingerTableEntries: 16,
        // stabilizeInterval: 1000
        // fixFingersInterval: 1000
    },
    scribe: {
        // scribeConfig.refreshInterval: 5000
    },
    bopclient: {
        // joinDelay: 5000
        // joinTrials: 3
        // bopid: {random}
    }
};

module.exports = config;

},{}],10:[function(require,module,exports){
/** @fileOverview Mid-level connection broking and signaling functionality. */

var Peer = require('./peer.js');
var BigInteger = require('./third_party/BigInteger.js');

var connManConfig = require('./config.js').connectionManager;

/**
 * @constructor
 * @class Handles the connection establishment to other nodes as
 * well as joining a network.
 */
var ConnectionManager = function() {
    if (!(this instanceof ConnectionManager)) {
        return new ConnectionManager();
    }
    this._pending = {};
    this._pcoptions = connManConfig.pcoptions || {
        iceServers: [{
            "url": "stun:localhost"
        }]
    };
    this._dcoptions = connManConfig.dcoptions || {};
    return this;
};

ConnectionManager.prototype = {

    utils: {
        /**
         * Returns a list of field values of the given field in the given SDP.
         */
        findInSDP: function(sdp, field) {
            var result = [];
            sdp.split('\r\n').forEach(function(line) {
                if (line.match(new RegExp("^" + field + "="))) {
                    result.push(line.split("=", 2)[1]);
                }
            });
            return result;
        },

        /**
         * Returns the session ID contained in the given SDP. This ID is used
         * for glare handling.
         */
        findSessionId: function(sdp) {
            return parseInt(this.findInSDP(sdp, "o")[0].split(" ")[1], 10);
        },
    },

    /**
     * Connects this instance to the P2P network by establishing a DataChannel
     * connection to an arbitrary peer.
     *
     * @param router {Router} used for delivering the initial offer.
     * @param successCallback {Function} called when a connection has been established
     * and the peer is ready to send/receive data.
     * @param errorCallback {Function} called when the connection could not be
     * established.
     */
    bootstrap: function(router, successCallback, errorCallback) {
        this._router = router;
        router.registerDeliveryCallback('signaling-protocol', this._onMessage.bind(this));
        this.connect("*", function(err, peer) {
            if (err) {
                if (err !== "Offer denied") {
                    errorCallback(err);
                    return;
                } else {
                    successCallback();
                    return;
                }
            }
            this._router.join(peer, function(err) {
                if (err) {
                    errorCallback(err);
                    return;
                }
                successCallback();
            });
        }.bind(this));
    },

    /**
     * Creates a DataChannel connection to the given peer.
     *
     * @param to ID of the remote peer
     */
    connect: function(to, callback) {
        var pc = new RTCPeerConnection(this._pcoptions);
        var dc = pc.createDataChannel(null, this._dcoptions);
        var seqnr = Math.floor(Math.random() * 1000000);
        this._pending[seqnr] = {
            seqnr: seqnr,
            pc: pc,
            dc: dc,
            callback: callback,
        };
        pc.createOffer(this._onCreateOfferSuccess.bind(this, pc, to, this._pending[seqnr],
            callback), this._onCreateOfferError.bind(this, callback));
    },

    _onCreateOfferSuccess: function(pc, to, pendingOffer, callback, sessionDesc) {
        if (pendingOffer.drop) {
            return;
        }
        pc.onicecandidate = function(iceEvent) {
            if (pc.iceGatheringState === 'complete' || iceEvent.candidate === null) {
                // spec specifies that a null candidate means that the ice gathering is complete
                pc.onicecandidate = function() {};
                pc.createOffer(function(offer) {
                    this._router.route(to, {
                        type: 'signaling-protocol',
                        seqnr: pendingOffer.seqnr,
                        to: to.toString(),
                        from: this._router.id.toString(),
                        payload: {
                            type: "offer",
                            offer: offer
                        }
                    }, function(err) {
                        if (err) {
                            callback(err);
                        }
                    });
                }.bind(this), this._onCreateOfferError.bind(this, callback));
            }
        }.bind(this);
        pc.setLocalDescription(sessionDesc, function() {}, function(err) {
            console.error("Error setting local description", err);
        });
    },

    _onCreateOfferError: function(callback, error) {
        // TODO(max): clean up state (delete PC object etc.)
        callback(error);
    },

    _onMessage: function(msg) {
        if (msg.type !== 'signaling-protocol') {
            console.log('ConnectionManager: Discarding JSEP message because the type is unknown: ' + JSON.stringify(msg));
            return;
        }

        switch (msg.payload.type) {
            case 'offer':
                this._onReceiveOffer(msg, new BigInteger(msg.from));
                break;
            case 'answer':
                this._onReceiveAnswer(msg, new BigInteger(msg.from));
                break;
            case 'denied':
                this._onOfferDenied(msg);
                break;
            default:
                console.log('ConnectionManager: Discarding JSEP message because the type is unknown: ' + JSON.stringify(msg));
        }
    },

    _onReceiveAnswer: function(message, from) {
        var desc = message.payload.answer;
        var pending = this._pending[message.seqnr];
        if (pending === undefined) {
            return; // we haven't offered to this node, silently discard
        }
        pending.pc.setRemoteDescription(new RTCSessionDescription(desc), function() {}, function(err) {
            console.error("Error setting remote description", err);
        });
        pending.dc.onopen = function(ev) {
            // nodejs wrtc-library does not include a channel reference in `ev.target`
            var peer = new Peer(from, pending.pc, pending.dc);
            peer.sendHeartbeat(function(err) {
                if (typeof(pending.callback) !== 'function') {
                    return;
                }
                if (err) {
                    pending.callback(err);
                } else {
                    // TODO(max): would it make sense to pass the remote peer's
                    // ID to the handler?
                    pending.callback(null, peer);
                }
                delete this._pending[message.seqnr];
            }.bind(this));
        }.bind(this);
    },

    _onReceiveOffer: function(message, from) {
        var self = this;
        var desc = message.payload.offer;
        var offerId = self.utils.findSessionId(desc.sdp);
        var pc = new RTCPeerConnection(self._pcoptions);
        pc.setRemoteDescription(new RTCSessionDescription(desc), function() {}, function(err) {
            console.error("could not set remote description", err);
        });
        if (self._pending[message.seqnr]) {
            self._pending[message.seqnr].pc = pc;
        }
        pc.ondatachannel = function(ev) {
            ev.channel.onopen = function(ev2) {
                // nodejs wrtc-library does not include a channel reference in `ev2.target`
                var peer = new Peer(from, pc, ev.channel);
                peer.sendHeartbeat(function(err) {
                    if (err) {
                        self._pending[message.seqnr].callback(err);
                    } else {
                        self._router.addPeer(peer, function(err) {
                            if (self._pending[message.seqnr]) {
                                if (typeof(self._pending[message.seqnr].callback) === 'function') {
                                    self._pending[message.seqnr].callback(err, peer);
                                }
                                delete self._pending[message.seqnr];
                            }
                        });
                    }
                });
            };
        };
        pc.createAnswer(self._onCreateAnswerSuccess.bind(self, from, pc, message.seqnr), self._onCreateAnswerError.bind(self));
    },

    _onCreateAnswerSuccess: function(to, pc, seqnr, sessionDesc) {
        pc.onicecandidate = function(iceEvent) {
            if (pc.iceGatheringState === 'complete' || iceEvent.candidate === null) {
                // spec specifies that a null candidate means that the ice gathering is complete
                pc.onicecandidate = function() {};
                pc.createAnswer(function(answer) {
                    this._router.route(to, {
                        type: 'signaling-protocol',
                        seqnr: seqnr,
                        to: to.toString(),
                        from: this._router.id.toString(),
                        payload: {
                            type: "answer",
                            answer: answer
                        }
                    }, function(err) {
                        if (err) {
                            console.log(err);
                        }
                    });
                }.bind(this), this._onCreateAnswerError.bind(this));
            }
        }.bind(this);
        pc.setLocalDescription(new RTCSessionDescription(sessionDesc), function() {}, function(err) {
            console.error("Error setting local description", err);
        });
    },

    _onCreateAnswerError: function(error) {
        console.log(error);
    },

    /**
     * The server denies offers when only one peer is connected since there is
     * no other peer that could answer the offer. In that case the first peer
     * just has to sit and wait for an offer. Eventually the successCallback is
     * called.
     */
    _onOfferDenied: function(message) {
        this._pending[message.seqnr].callback("Offer denied");
        delete this._pending[message.seqnr];
    },

};

if (typeof(module) !== 'undefined') {
    module.exports = ConnectionManager;
}

},{"./config.js":9,"./peer.js":11,"./third_party/BigInteger.js":15}],11:[function(require,module,exports){
/** @fileOverview Represents a Peer in the network */

var peerConfig = require('./config.js').peer;

/**
 * @constructor
 * @class Represents a foreign Peer. Used by {@link Router} instances to route
 * messages from one Peer to another. Control over a Peer lies in the hand of a
 * {@link ConnectionManager} instance.
 *
 * @param id {String}
 * @param peerConnection {RTCPeerConnection} The PeerConnection to the remote peer.
 * @param dataChannel {DataChannel} The DataChannel to the remote peer.
 */
var Peer = function(id, peerConnection, dataChannel) {
    if (!(this instanceof Peer)) {
        return new Peer(id, peerConnection, dataChannel);
    }
    this.id = id;
    this._peerConnection = peerConnection;
    this._dataChannel = dataChannel;
    this._dataChannel.onmessage = this._onmessage.bind(this);
    this._heartbeatDefaultTimer = peerConfig.messageTimeout || 1000;
    this._heartbeatCallbacks = {};
};

Peer.prototype.send = function(msg) {
    var stringifiedMsg = JSON.stringify(msg);
    try {
        this._dataChannel.send(stringifiedMsg);
    } catch (e) {
        throw new Error('Peer could not send message over datachannel: \'' + stringifiedMsg + '\'; Cause: ' + e.name + ': ' + e.message);
    }
};

Peer.prototype._onmessage = function(rawMsg) {
    var msg;
    try {
        msg = JSON.parse(rawMsg.data);
    } catch (e) {
        console.log('Cannot parse message', rawMsg);
    }
    if (msg.type === 'heartbeat') {
        this._onheartbeat(msg);
    } else {
        this.onmessage(msg);
    }
};

Peer.prototype.onmessage = function() {
    // overwrite
};

Peer.prototype.onclose = function() {
    // overwrite
};

Peer.prototype.sendHeartbeat = function(cb, timeout) {
    var self = this;
    var randomnumber = Math.floor(Math.random() * 100001);
    self._heartbeatCallbacks[randomnumber] = cb;
    try {
        self.send({
            type: 'heartbeat',
            request: true,
            sqnr: randomnumber
        });
    } catch (e) {
        // sweep this under the table as the error is handled by the timeout
    }
    setTimeout(function() {
        if (self._heartbeatCallbacks[randomnumber]) {
            self._heartbeatCallbacks[randomnumber]('Peer unreachable');
        }
    }, timeout || self._heartbeatDefaultTimer);
};

Peer.prototype._onheartbeat = function(msg) {
    var self = this;
    if (msg.request) {
        self.send({
            type: 'heartbeat',
            response: true,
            sqnr: msg.sqnr
        });
    } else if (msg.response) {
        self._heartbeatCallbacks[msg.sqnr]();
        delete self._heartbeatCallbacks[msg.sqnr];
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = Peer;
}

},{"./config.js":9}],12:[function(require,module,exports){
var RingBuffer = function(size) {
    if (typeof size !== 'number' || size <= 0) {
        throw new RangeError("RingBuffer size must be > 0");
    }
    if (!(this instanceof RingBuffer)) {
        return new RingBuffer(size);
    }
    this._array = Array(size);
    this._curIdx = 0;
};

RingBuffer.prototype = {
    push: function(val) {
        this._array[this._curIdx] = val;
        this._curIdx = (this._curIdx + 1) % this._array.length;
        return this;
    },

    get: function(idx) {
        return this._array[idx % this._array.length];
    },

    getall: function() {
        return this._array.slice(0);
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = RingBuffer;
}

},{}],13:[function(require,module,exports){
/** @fileOverview Routing functionality */

var Peer = require('./peer.js');
var BigInteger = require('./third_party/BigInteger.js');
var Sha1 = require('./third_party/sha1.js');
var Range = require('./chord/range.js');

/**
 * @constructor
 * @class The main routing class. Used by {@link ConnectionManager} instances to route
 * messages through the user network.
 *
 * @param id ID of the local peer
 * @param fallbackSignaling
 */
var Router = function(id, fallbackSignaling, connectionManager) {
    if (!(this instanceof Router)) {
        return new Router();
    }

    this._peerTable = {};
    this._fallbackSignaling = fallbackSignaling;
    this._fallbackSignaling.onmessage = this.onmessage.bind(this);
    this._connectionManager = connectionManager;
    this.id = id;
    this._messageCallbacks = {};
    this._monitorCallback = null;
    this._pendingPutRequests = {};
    this._pendingGetRequests = {};
    this.registerDeliveryCallback('discovery-protocol', this._onDiscoveryMessage.bind(this));

    return this;
};

Router.randomId = function() {
    var randomId = Sha1.bigIntHash(Math.random().toString());
    return randomId;
};

Router.prototype = {

    /**
     * Add a peer to the peer table.
     *
     * @param peer {Peer} The peer to add.
     * @todo add test for onclosedconnection behaviour
     */
    addPeer: function(peer, cb) {
        this._peerTable[peer.id] = peer;
        peer.onmessage = this.onmessage.bind(this);
        peer.onclose = this.removePeer.bind(this, peer);
        if (Object.keys(this._peerTable).length === 1) {
            // ask first peer for its neighbours
            this._discoverNeighbours(peer);
        }
        if (typeof(cb) === 'function') {
            cb();
        }
    },

    /**
     * Remove a peer from the peer table.
     *
     * @param peer {Peer} The peer to remove.
     * @todo disconnect peerConnection before removal
     */
    removePeer: function(peer) {
        delete this._peerTable[peer.id];
    },

    /**
     * Return a list of all peer ids currently in the routing table.
     *
     * @returns {Array}
     */
    getPeerIds: function() {
        var peers = [];
        var peer;
        for (peer in this._peerTable) {
            if (this._peerTable.hasOwnProperty(peer)) {
                peers.push(peer);
            }
        }
        return peers;
    },

    onmessage: function(msg) {
        try {
            this.forward(JSON.parse(msg.data));
        } catch (e) {
            console.log('Unable to parse incoming message ' + JSON.stringify(msg.data) + ': ' + e);
        }
    },

    /**
     * Encapsulates message in router format and forwards them.
     *
     * @param to recipient
     * @param type the message type
     * @param payload the message payload
     */
    route: function(to, payload) {
        if (typeof(to) !== 'string') {
            to = to.toString();
        }
        this.forward({
            to: to,
            from: this.id.toString(),
            type: 'ROUTE',
            payload: payload
        });
    },

    /**
     * Forward message or deliver if recipient is me. This implementation
     * implies that we are using a fully meshed network where every peer
     * is connected to all other peers.
     *
     * @param msg {String} The message to route.
     */
    forward: function(msg) {
        if (typeof(this._monitorCallback) === 'function') {
            this._monitorCallback(msg);
        }
        if (!msg.to) {
            throw Error('Unable to route message because no recipient can be determined');
        }
        if (this.id.toString() === msg.to) {
            this.deliver(msg);
            return;
        }
        var receiver = this._peerTable[msg.to];
        if (!(receiver instanceof Peer)) {
            this._fallbackSignaling.send(JSON.stringify(msg));
            return;
        }
        try {
            receiver.send(msg);
        } catch (e) {
            console.log('Unable to route message to ' + msg.to + ' because the DataChannel connection failed.');
        }
    },

    get: function(hash, cb) {
        this._pendingGetRequests[hash.toString()] = cb;
        var peer = this.responsible(hash);
        this.forward({
            to: peer.toString(),
            from: this.id.toString(),
            type: 'GET',
            payload: {
                type: 'request',
                hash: hash.toString()
            }
        });
    },

    _handleGET: function(msg) {
        if (msg.payload.type === 'request') {
            this._handleGetRequest(msg);
        } else if (msg.payload.type === 'response') {
            this._handleGetResponse(msg);
        } else {
            console.log('received invalid GET message', msg);
        }
    },

    _handleGetRequest: function(msg) {
        try {
            var val = JSON.parse(localStorage.getItem(msg.payload.hash));
            this.forward({
                to: msg.from,
                from: this.id.toString(),
                type: 'GET',
                payload: {
                    type: 'response',
                    hash: msg.payload.hash,
                    val: val
                }
            });
        } catch (e) {
            console.log(e);
        }
    },

    _handleGetResponse: function(msg) {
        if (typeof(this._pendingGetRequests[msg.payload.hash]) === 'function') {
            this._pendingGetRequests[msg.payload.hash.toString()](null, msg.payload.val);
            delete this._pendingGetRequests[msg.payload.hash.toString()];
        }
    },

    put: function(hash, val, cb) {
        this._pendingPutRequests[hash.toString()] = cb;
        var peer = this.responsible(hash);
        this.forward({
            to: peer.toString(),
            from: this.id.toString(),
            type: 'PUT',
            payload: {
                type: 'request',
                hash: hash.toString(),
                val: val
            }
        });
    },

    _handlePUT: function(msg) {
        if (msg.payload.type === 'request') {
            this._handlePutRequest(msg);
        } else if (msg.payload.type === 'response') {
            this._handlePutResponse(msg);
        } else {
            console.log('received invalid PUT message', msg);
        }
    },

    _handlePutRequest: function(msg) {
        try {
            localStorage.setItem(msg.payload.hash, JSON.stringify(msg.payload.val));
            this.forward({
                to: msg.from,
                from: this.id.toString(),
                type: 'PUT',
                payload: {
                    type: 'response',
                    hash: msg.payload.hash
                }
            });
        } catch (e) {
            console.log(e);
        }
    },

    _handlePutResponse: function(msg) {
        if (typeof(this._pendingPutRequests[msg.payload.hash]) === 'function') {
            this._pendingPutRequests[msg.payload.hash](null);
        }
    },

    responsible: function(hash) {
        var candidate = this.id;
        for (var k in this._peerTable) {
            if (Range.inLeftClosedInterval(new BigInteger(k), hash, candidate)) {
                candidate = new BigInteger(k);
            }
        }
        return candidate;
    },

    /**
     * Deliver a message to this peer. Is called when the `to` field of
     * the message contains the id of this peer. Decides where to deliver
     * the message to by calling the registered callback using the `type`
     * field (e.g. webrtc connection/ neighbour discovery/ application) of
     * the message.
     *
     * @param msg {String}
     */
    deliver: function(msg) {
        switch (msg.type) {
            case 'ROUTE':
                try {
                    this._messageCallbacks[msg.payload.type](msg.payload);
                } catch (e) {
                    console.log(msg);
                    console.log('Unable to handle message of type ' + msg.payload.type + ' from ' + msg.payload.from + ' because no callback is registered: ' + e);
                }
                break;
            case 'ACK':
                // silently discard ACK messages as they 
                // are only used for the Chord implementation
                break;
            case 'GET':
                this._handleGET(msg);
                break;
            case 'PUT':
                this._handlePUT(msg);
                break;
            default:
                console.log('Discarding message', msg, 'because the type is unknown');
        }
    },

    /**
     * Register a delivery callback. The registered callback gets
     * called when a specific type of message arrives with the `from`
     * field set to this peers' id.
     *
     * @param msgType {String} refers to the `type`-field of the message
     * this callback should respond to
     * @param callback {Function} The callback to call when a message of
     * the given type arrives
     */
    registerDeliveryCallback: function(msgType, callback) {
        this._messageCallbacks[msgType] = callback;
    },

    /**
     * Register a monitor callback. The registered callback gets
     * called when a message arrives with the `from` field set to
     * this peers' id.
     *
     * @param callback {Function} The callback to call when a message is delivered
     */
    registerMonitorCallback: function(callback) {
        this._monitorCallback = callback;
    },

    /**
     * Kick off neighbour discovery mechanism by sending a `discovery-request' message to
     * a connected peer.
     *
     * @param peer {Peer}
     * @todo implement
     */
    _discoverNeighbours: function(peer) {
        this.route(peer.id, {
            type: 'discovery-protocol',
            payload: {
                type: 'request',
                from: this.id.toString()
            }
        });
    },

    _onDiscoveryMessage: function(msg) {
        switch (msg.payload.type) {
            case 'response':
                this._processDiscoveryResponse(msg);
                break;
            case 'request':
                this._processDiscoveryRequest(msg);
                break;
            default:
                console.log('Router: received invalid discovery message with type %s from %s', msg.payload.type, msg.payload.from);
                break;
        }
    },

    /**
     * Gets called when a neighbour discovery response message is received.
     *
     * @param msg {String} Message containing ids of another peers peer table.
     * @todo should this call the connection manager?
     */
    _processDiscoveryResponse: function(msg) {
        //console.log('connecting to', msg.payload.ids)
        var i, ids = msg.payload.ids;
        for (i = 0; i < ids.length; i++) {
            if (ids[i] !== this.id.toString()) {
                this._connectionManager.connect(ids[i], this._processDiscoveryCallback.bind(this, ids[i]));
            }
        }
    },

    _processDiscoveryCallback: function(id, err) {
        if (err) {
            console.log('Error connecting to', id, ':', err);
        }
    },

    /**
     * Answer a received neighbour discovery message. Respond with
     * known ids of all peers in the peerTable.
     *
     * @param msg {String} Message containing the discovery request from another peer.
     * @todo discovery message format
     */
    _processDiscoveryRequest: function(msg) {
        var peerIds = [],
            peer;
        for (peer in this._peerTable) {
            if (this._peerTable.hasOwnProperty(peer) && this._peerTable[peer] instanceof Peer) {
                peerIds.push(peer);
            }
        }
        this.route(msg.payload.from, {
            type: 'discovery-protocol',
            payload: {
                type: 'response',
                from: this.id.toString(),
                ids: peerIds
            }
        });
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = Router;
}

},{"./chord/range.js":7,"./peer.js":11,"./third_party/BigInteger.js":15,"./third_party/sha1.js":16}],14:[function(require,module,exports){
/** @fileOverview Scribe ALM */

var BigInteger = require('./third_party/BigInteger.js');
var Sha1 = require('./third_party/sha1.js');

var scribeConfig = require('./config.js').scribe;

var Scribe = function(router) {
    if (!(this instanceof Scribe)) {
        return new Scribe(router);
    }
    this._router = router;
    this._messageTypes = {
        CREATE: 'CREATE',
        LEAVE: 'LEAVE',
        SUBSCRIBE: 'SUBSCRIBE',
        PUBLISH: 'PUBLISH',
        DATA: 'DATA'
    };
    this._subscriptions = {}; // [groupHash][member]
    this._mySubscriptions = {}; // [groupHash]
    this._createdGroups = {}; // [groupHash]
    this._router.registerDeliveryCallback('bopscribe-protocol', this._onmessage.bind(this));
    this._router.registerInterceptor(this._onRouteIntercept.bind(this));
    this._refreshInterval = scribeConfig.refreshInterval || 5000; // ms
    setInterval(this.maintain.bind(this), this._refreshInterval);
};

Scribe.prototype = {
    maintain: function() {
        var self = this;
        // create groups periodically
        for (var grpHashStr in self._createdGroups) {
            self.create(self._createdGroups[grpHashStr], function(err, groupId) {
                if (err) {
                    console.log('could not re-create group: ' + self._createdGroups[grpHashStr] + err);
                }
            });
        }
        // remove old subscriptions
        for (var group in self._subscriptions) {
            for (var memberId in self._subscriptions[group]) {
                if (Date.now() - self._subscriptions[group][memberId].added >= self._refreshInterval * 1.5) {
                    delete self._subscriptions[group][memberId];
                }
            }
        }
        // re-subscribe to keep me in remote subscriber list
        for (var myGrpHashStr in self._mySubscriptions) {
            self.subscribe(self._mySubscriptions[myGrpHashStr], function(err, groupId) {
                if (err) {
                    console.log('could not re-subscribe to group' + self._mySubscriptions[myGrpHashStr] + err);
                }
            });
        }
    },
    _getSubscriptions: function() {
        var self = this;
        var arr = [];
        for (var group in self._subscriptions) {
            arr.push(self._mySubscriptions[group]);
        }
        return arr;
    },
    getMySubscriptions: function() {
        var self = this;
        var arr = [];
        for (var group in self._subscriptions) {
            for (var subId in self._subscriptions[group]) {
                if (subId === self._router.id.toString()) {
                    var groupname = self._mySubscriptions[group];
                    if (groupname) { // group might not yet be removed 
                        arr.push(groupname);
                    }
                }
            }
        }
        return arr;
    },
    _onRouteIntercept: function(msg, next) {
        var self = this;
        var to = msg.to;
        var routerPayload = msg.payload;
        var protoPayload = routerPayload.payload;

        if (routerPayload.type === 'bopscribe-protocol') {
            if (protoPayload.type === self._messageTypes.PUBLISH && self._router._localNode.responsible(to)) {
                // somebody publishes in a group that belongs to us
                return self._handlePublish(msg, next);
            } else if (protoPayload.type === self._messageTypes.SUBSCRIBE) {
                // somebody subscribes, intercept and add him as subscriber
                return self._handleSubscribe(msg, next);
            } else if (protoPayload.type === self._messageTypes.LEAVE) {
                // child leaves a group. propagate or stop
                return self._handleLeave(msg, next);
            }
        }
        return next(null, msg);
    },
    _onmessage: function(msg) {
        var self = this;
        if (!msg || (msg.type !== 'bopscribe-protocol')) {
            return console.log('Scribe: Discarding message because the type is unknown', msg);
        } else if (msg.payload.type !== self._messageTypes.DATA) {
            return console.log('Scribe: This message should not have gotten here', msg);
        }
        self._handleMessage(msg.payload);
    },
    _send: function(to, msg, cb) {
        var self = this;
        if (!to || !msg || !cb) {
            throw Error('Malformed send request');
        }
        // fit group id into key space
        to = to.mod(BigInteger(2).pow(self._router._m));
        self._router.route(to, {
            from: self._router.id,
            type: 'bopscribe-protocol',
            payload: msg
        }, cb);
    },
    remove: function(groupId, cb) {
        // @todo: remove key from dht
        var self = this;
        var hash = Sha1.bigIntHash(groupId).mod(BigInteger(2).pow(self._router._m));
        if (this._createdGroups[hash]) {
            delete this._createdGroups[hash];
            return cb(null, groupId);
        } else {
            return cb('Could not remove; we did not create group: ' + groupId);
        }
    },
    create: function(groupId, cb) {
        var self = this;
        var hash = Sha1.bigIntHash(groupId).mod(BigInteger(2).pow(self._router._m));
        self._router.put(hash, {
            groupId: groupId,
            creator: self._router.id.toString(),
            createdOn: Date.now()
        }, function(err, res) {
            if (!err) {
                self._createdGroups[hash.toString()] = groupId;
                cb(null, groupId);
            } else {
                cb('Could not create the group: ' + err);
            }
        });
    },
    leave: function(groupId, cb) {
        var self = this;
        var hash = Sha1.bigIntHash(groupId).mod(BigInteger(2).pow(self._router._m));
        var hashStr = hash.toString();

        // i want to leave the group
        if (self._subscriptions[hashStr]) {
            delete self._mySubscriptions[hashStr];
        } else {
            return cb('Not a member of group: ' + groupId);
        }

        self._send(hash, {
            type: self._messageTypes.LEAVE,
            peerId: self._router.id.toString()
        }, function(err, msg) {
            if (err) {
                return cb(err);
            } else {
                cb(null, groupId);
            }
        });
    },
    publish: function(groupId, msg, cb) {
        var self = this;
        if (typeof(cb) !== 'function') {
            throw new Error('Callback not specified');
        } else if (!groupId) {
            // @todo: check if groupId is a valid bopuri
            return cb('Discarding message as no groupId has been specified');
        } else if (!msg) {
            return cb('Discarding empty message');
        }
        var groupHash = Sha1.bigIntHash(groupId);
        self._send(groupHash, {
            type: self._messageTypes.PUBLISH,
            payload: msg
        }, function(err, msg) {
            if (err) {
                return cb(err);
            } else {
                cb(null, groupId);
            }
        });
    },
    subscribe: function(groupId, cb) {
        var self = this;
        if (typeof(cb) !== 'function') {
            throw new Error('Callback not specified');
        } else if (!groupId) {
            // @todo: check if groupId is a valid bopuri
            return cb('Discarding message as no groupId has been specified');
        }
        var peerId = self._router.id;
        var groupHash = Sha1.bigIntHash(groupId).mod(BigInteger(2).pow(self._router._m));

        self._send(groupHash, {
            type: self._messageTypes.SUBSCRIBE,
            groupId: groupId.toString(),
            from: peerId.toString()
        }, function(err, msg) {
            if (err) {
                return cb(err);
            } else {
                self._mySubscriptions[groupHash] = groupId;
                cb(null, groupId);
            }
        });
    },
    _handleSubscribe: function(msg, next) {
        var self = this;
        var groupHash = new BigInteger(msg.to);
        var routerPayload = msg.payload;
        var protoPayload = routerPayload.payload;

        var from = new BigInteger(protoPayload.from);

        if (!self._subscriptions[groupHash]) {
            self._subscriptions[groupHash] = {};
        }
        self._subscriptions[groupHash][from] = {
            added: Date.now(),
            peerId: from
        };
        if (!self._router._localNode.responsible(groupHash)) {
            // propagate subscribe if i am not the rendezvous point
            protoPayload.from = self._router.id.toString();
            next(null, msg, false);
        } else {
            // we are the rendezvous point - drop message
            // console.log('We are the rendezvous point for group %s', groupHash.toString());
            next(null, msg, true);
        }
    },
    _handlePublish: function(msg, next) {
        var self = this;
        var to = msg.to;
        var routerPayload = msg.payload;
        var protoPayload = routerPayload.payload;

        var groupHash = new BigInteger(to);
        // @todo: is the publisher authorized?

        // drop message, we respond with a `_messageTypes.DATA`
        next(null, msg, true);

        if (self._subscriptions[groupHash] && Object.keys(self._subscriptions[groupHash]).length <= 0) {
            return console.log('no subscribers for', groupHash.toString());
        }
        self._send(self._router.id, {
            type: self._messageTypes.DATA,
            groupHash: groupHash.toString(),
            payload: protoPayload.payload
        }, function(err, msg) {
            if (err) {
                console.log('Rendezvous point could not send message: ' + err);
            }
        });
    },
    _handleLeave: function(msg, next) {
        var self = this;
        var to = msg.to;
        var routerPayload = msg.payload;
        var protoPayload = routerPayload.payload;
        var groupHash = new BigInteger(to);
        var groupHashStr = groupHash.toString();
        var peerIdStr = protoPayload.peerId;

        // remove leaver
        if (self._subscriptions[groupHashStr]) {
            delete self._subscriptions[groupHashStr][peerIdStr];
        }

        // propagate leave if no subscribers are left and we are not the rendezvous point
        if (!self._subscriptions[groupHashStr] || Object.keys(self._subscriptions[groupHashStr]).length <= 0) {
            // cleanup group
            delete self._subscriptions[groupHashStr];
            if (!self._router._localNode.responsible(groupHash)) {
                return next(null, msg, false);
            }
        }
        // we still have some subscribers or we are the root. consume leave
        return next(null, msg, true);
    },
    _handleMessage: function(msg) {
        var self = this;
        var payload = msg.payload;
        var groupHashStr = msg.groupHash;

        // propagate message subscribers of the group
        for (var index in self._subscriptions[groupHashStr]) {
            var peerId = self._subscriptions[groupHashStr][index].peerId;
            if (peerId.equals(self._router.id)) {
                // its for me, deliver to application
                try {
                    self.onmessage(self._mySubscriptions[groupHashStr], payload);
                } catch (e) {
                    console.log('BOPscribe: Could not deliver message to subscriber ', msg, e);
                }
            } else {
                self._send(peerId, msg, function(err) {
                    if (err) {
                        console.log('BOPscribe: Error sending message to a subscriber', msg, err);
                    }
                });
            }
        }
    },
    onmessage: function(group, msg) {
        // overwrite me
    }
};

if (typeof(module) !== 'undefined') {
    module.exports = Scribe;
}

},{"./config.js":9,"./third_party/BigInteger.js":15,"./third_party/sha1.js":16}],15:[function(require,module,exports){
var bigInt = (function() {
    var base = 10000000,
        logBase = 7;
    var sign = {
        positive: false,
        negative: true
    };

    var normalize = function(first, second) {
        var a = first.value,
            b = second.value,
            i;
        var length = a.length > b.length ? a.length : b.length;
        for (i = 0; i < length; i++) {
            a[i] = a[i] || 0;
            b[i] = b[i] || 0;
        }
        for (i = length - 1; i >= 0; i--) {
            if (a[i] === 0 && b[i] === 0) {
                a.pop();
                b.pop();
            } else {
                break;
            }
        }
        if (!a.length) {
            a = [0];
            b = [0];
        }
        first.value = a;
        second.value = b;
    };

    var parse = function(text, first) {
        if (typeof text === "object") {
            return text;
        }
        text += "";
        var s = sign.positive,
            value = [];
        if (text[0] === "-") {
            s = sign.negative;
            text = text.slice(1);
        }
        text = text.split("e");
        if (text.length > 2) {
            throw new Error("Invalid integer: " + text);
        }
        if (text[1]) {
            var exp = text[1];
            if (exp[0] === "+") {
                exp = exp.slice(1);
            }
            exp = parse(exp);
            if (exp.lesser(0)) {
                throw new Error("Cannot include negative exponent part for integers");
            }
            while (exp.notEquals(0)) {
                text[0] += "0";
                exp = exp.prev();
            }
        }
        text = text[0];
        if (text === "-0") {
            text = "0";
        }
        var isValid = /^([0-9][0-9]*)$/.test(text);
        if (!isValid) {
            throw new Error("Invalid integer: " + text);
        }
        while (text.length) {
            var divider = text.length > logBase ? text.length - logBase : 0;
            value.push(+text.slice(divider));
            text = text.slice(0, divider);
        }
        var val = bigInt(value, s);
        if (first) {
            normalize(first, val);
        }
        return val;
    };

    var goesInto = function(a, b) {
        a = bigInt(a, sign.positive);
        b = bigInt(b, sign.positive);
        if (a.equals(0)) {
            throw new Error("Cannot divide by 0");
        }
        var n = 0;
        do {
            var inc = 1;
            var c = bigInt(a.value, sign.positive),
                t = c.times(10);
            while (t.lesser(b)) {
                c = t;
                inc *= 10;
                t = t.times(10);
            }
            while (c.lesserOrEquals(b)) {
                b = b.minus(c);
                n += inc;
            }
        } while (a.lesserOrEquals(b));

        return {
            remainder: b.value,
            result: n
        };
    };

    var bigInt = function(value, s) {
        var self = {
            value: value,
            sign: s
        };
        var o = {
            value: value,
            sign: s,
            negate: function(m) {
                var first = m || self;
                return bigInt(first.value, !first.sign);
            },
            abs: function(m) {
                var first = m || self;
                return bigInt(first.value, sign.positive);
            },
            add: function(n, m) {
                var s, first = self,
                    second;
                if (m) {
                    first = parse(n);
                    second = parse(m);
                } else {
                    second = parse(n, first);
                }
                s = first.sign;
                if (first.sign !== second.sign) {
                    first = bigInt(first.value, sign.positive);
                    second = bigInt(second.value, sign.positive);
                    return s === sign.positive ?
                        o.subtract(first, second) :
                        o.subtract(second, first);
                }
                normalize(first, second);
                var a = first.value,
                    b = second.value;
                var result = [],
                    carry = 0;
                for (var i = 0; i < a.length || carry > 0; i++) {
                    var sum = (a[i] || 0) + (b[i] || 0) + carry;
                    carry = sum >= base ? 1 : 0;
                    sum -= carry * base;
                    result.push(sum);
                }
                return bigInt(result, s);
            },
            plus: function(n, m) {
                return o.add(n, m);
            },
            subtract: function(n, m) {
                var first = self,
                    second;
                if (m) {
                    first = parse(n);
                    second = parse(m);
                } else {
                    second = parse(n, first);
                }
                if (first.sign !== second.sign) {
                    return o.add(first, o.negate(second));
                }
                if (first.sign === sign.negative) {
                    return o.subtract(o.negate(second), o.negate(first));
                }
                if (o.compare(first, second) === -1) {
                    return o.negate(o.subtract(second, first));
                }
                var a = first.value,
                    b = second.value;
                var result = [],
                    borrow = 0;
                for (var i = 0; i < a.length; i++) {
                    var tmp = a[i] - borrow;
                    borrow = tmp < b[i] ? 1 : 0;
                    var minuend = (borrow * base) + tmp - b[i];
                    result.push(minuend);
                }
                return bigInt(result, sign.positive);
            },
            minus: function(n, m) {
                return o.subtract(n, m);
            },
            multiply: function(n, m) {
                var s, first = self,
                    second, k;
                if (m) {
                    first = parse(n);
                    second = parse(m);
                } else {
                    second = parse(n, first);
                }
                s = first.sign !== second.sign;
                var a = first.value,
                    b = second.value;
                var resultSum = [];
                for (var i = 0; i < a.length; i++) {
                    resultSum[i] = [];
                    var j = i;
                    while (j--) {
                        resultSum[i].push(0);
                    }
                }
                var carry = 0;
                for (i = 0; i < a.length; i++) {
                    var x = a[i];
                    for (k = 0; k < b.length || carry > 0; k++) {
                        var y = b[k];
                        var product = y ? (x * y) + carry : carry;
                        carry = product > base ? Math.floor(product / base) : 0;
                        product -= carry * base;
                        resultSum[i].push(product);
                    }
                }
                var max = -1;
                for (i = 0; i < resultSum.length; i++) {
                    var len = resultSum[i].length;
                    if (len > max) {
                        max = len;
                    }
                }
                var result = [];
                carry = 0;
                for (i = 0; i < max || carry > 0; i++) {
                    var sum = carry;
                    for (k = 0; k < resultSum.length; k++) {
                        sum += resultSum[k][i] || 0;
                    }
                    carry = sum > base ? Math.floor(sum / base) : 0;
                    sum -= carry * base;
                    result.push(sum);
                }
                return bigInt(result, s);
            },
            times: function(n, m) {
                return o.multiply(n, m);
            },
            divmod: function(n, m) {
                var s, first = self,
                    second;
                if (m) {
                    first = parse(n);
                    second = parse(m);
                } else {
                    second = parse(n, first);
                }
                s = first.sign !== second.sign;
                if (bigInt(first.value, first.sign).equals(0)) {
                    return {
                        quotient: bigInt([0], sign.positive),
                        remainder: bigInt([0], sign.positive)
                    };
                }
                if (second.equals(0)) {
                    throw new Error("Cannot divide by zero");
                }
                var a = first.value,
                    b = second.value;
                var result = [],
                    remainder = [];
                for (var i = a.length - 1; i >= 0; i--) {
                    n = [a[i]].concat(remainder);
                    var quotient = goesInto(b, n);
                    result.push(quotient.result);
                    remainder = quotient.remainder;
                }
                result.reverse();
                return {
                    quotient: bigInt(result, s),
                    remainder: bigInt(remainder, first.sign)
                };
            },
            divide: function(n, m) {
                return o.divmod(n, m).quotient;
            },
            over: function(n, m) {
                return o.divide(n, m);
            },
            mod: function(n, m) {
                return o.divmod(n, m).remainder;
            },
            pow: function(n, m) {
                var first = self,
                    second;
                if (m) {
                    first = parse(n);
                    second = parse(m);
                } else {
                    second = parse(n, first);
                }
                var a = first,
                    b = second;
                if (b.lesser(0)) {
                    return ZERO;
                }
                if (b.equals(0)) {
                    return ONE;
                }
                var result = bigInt(a.value, a.sign);

                if (b.mod(2).equals(0)) {
                    var c = result.pow(b.over(2));
                    return c.times(c);
                } else {
                    return result.times(result.pow(b.minus(1)));
                }
            },
            next: function(m) {
                var first = m || self;
                return o.add(first, 1);
            },
            prev: function(m) {
                var first = m || self;
                return o.subtract(first, 1);
            },
            compare: function(n, m) {
                var first = self,
                    second;
                if (m) {
                    first = parse(n);
                    second = parse(m, first);
                } else {
                    second = parse(n, first);
                }
                normalize(first, second);
                if (first.value.length === 1 && second.value.length === 1 && first.value[0] === 0 && second.value[0] === 0) {
                    return 0;
                }
                if (second.sign !== first.sign) {
                    return first.sign === sign.positive ? 1 : -1;
                }
                var multiplier = first.sign === sign.positive ? 1 : -1;
                var a = first.value,
                    b = second.value;
                for (var i = a.length - 1; i >= 0; i--) {
                    if (a[i] > b[i]) {
                        return 1 * multiplier;
                    }
                    if (b[i] > a[i]) {
                        return -1 * multiplier;
                    }
                }
                return 0;
            },
            compareAbs: function(n, m) {
                var first = self,
                    second;
                if (m) {
                    first = parse(n);
                    second = parse(m, first);
                } else {
                    second = parse(n, first);
                }
                first.sign = second.sign = sign.positive;
                return o.compare(first, second);
            },
            equals: function(n, m) {
                return o.compare(n, m) === 0;
            },
            notEquals: function(n, m) {
                return !o.equals(n, m);
            },
            lesser: function(n, m) {
                return o.compare(n, m) < 0;
            },
            greater: function(n, m) {
                return o.compare(n, m) > 0;
            },
            greaterOrEquals: function(n, m) {
                return o.compare(n, m) >= 0;
            },
            lesserOrEquals: function(n, m) {
                return o.compare(n, m) <= 0;
            },
            isPositive: function(m) {
                var first = m || self;
                return first.sign === sign.positive;
            },
            isNegative: function(m) {
                var first = m || self;
                return first.sign === sign.negative;
            },
            isEven: function(m) {
                var first = m || self;
                return first.value[0] % 2 === 0;
            },
            isOdd: function(m) {
                var first = m || self;
                return first.value[0] % 2 === 1;
            },
            toString: function(m) {
                var first = m || self;
                var str = "",
                    len = first.value.length;
                while (len--) {
                    if (first.value[len].toString().length === 8) {
                        str += first.value[len];
                    } else {
                        str += (base.toString() + first.value[len]).slice(-logBase);
                    }
                }
                while (str[0] === "0") {
                    str = str.slice(1);
                }
                if (!str.length) {
                    str = "0";
                }
                var s = first.sign === sign.positive ? "" : "-";

                var res = s + str;
                // pad to 49 chars
                if (res.length === 49) {
                    return res;
                }
                return "000000000000000000000000000000000000000000000000".substr(0, 49 - res.length) + res;
            },
            toJSNumber: function(m) {
                return +o.toString(m);
            },
            valueOf: function(m) {
                return o.toJSNumber(m);
            }
        };
        return o;
    };

    var ZERO = bigInt([0], sign.positive);
    var ONE = bigInt([1], sign.positive);
    var MINUS_ONE = bigInt([1], sign.negative);

    var fnReturn = function(a) {
        if (typeof a === "undefined") {
            return ZERO;
        }
        return parse(a);
    };
    fnReturn.zero = ZERO;
    fnReturn.one = ONE;
    fnReturn.minusOne = MINUS_ONE;
    return fnReturn;
})();

if (typeof module !== "undefined") {
    module.exports = bigInt;
}

},{}],16:[function(require,module,exports){
// Copyright 2005 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview SHA-1 cryptographic hash.
 * Variable names follow the notation in FIPS PUB 180-3:
 * http://csrc.nist.gov/publications/fips/fips180-3/fips180-3_final.pdf.
 *
 * Usage:
 *   var sha1 = new sha1();
 *   sha1.update(bytes);
 *   var hash = sha1.digest();
 *
 * Performance:
 *   Chrome 23:   ~400 Mbit/s
 *   Firefox 16:  ~250 Mbit/s
 *
 */

var BigInteger = require('./BigInteger');

/**
 * SHA-1 cryptographic hash constructor.
 *
 * The properties declared here are discussed in the above algorithm document.
 * @constructor
 */
var sha1 = function() {

    /**
     * Holds the previous values of accumulated variables a-e in the compress_
     * function.
     * @type {Array.<number>}
     * @private
     */
    this.chain_ = [];

    /**
     * A buffer holding the partially computed hash result.
     * @type {Array.<number>}
     * @private
     */
    this.buf_ = [];

    /**
     * An array of 80 bytes, each a part of the message to be hashed.  Referred to
     * as the message schedule in the docs.
     * @type {Array.<number>}
     * @private
     */
    this.W_ = [];

    /**
     * Contains data needed to pad messages less than 64 bytes.
     * @type {Array.<number>}
     * @private
     */
    this.pad_ = [];

    this.pad_[0] = 128;
    for (var i = 1; i < 64; ++i) {
        this.pad_[i] = 0;
    }

    this.reset();
};


/** @override */
sha1.prototype.reset = function() {
    this.chain_[0] = 0x67452301;
    this.chain_[1] = 0xefcdab89;
    this.chain_[2] = 0x98badcfe;
    this.chain_[3] = 0x10325476;
    this.chain_[4] = 0xc3d2e1f0;

    this.inbuf_ = 0;
    this.total_ = 0;
};


/**
 * Internal compress helper function.
 * @param {Array.<number>|Uint8Array|string} buf Block to compress.
 * @param {number=} opt_offset Offset of the block in the buffer.
 * @private
 */
sha1.prototype.compress_ = function(buf, opt_offset) {
    if (!opt_offset) {
        opt_offset = 0;
    }

    var W = this.W_,
        i, t;

    // get 16 big endian words
    if (typeof(buf) === 'string') {
        for (i = 0; i < 16; i++) {
            W[i] = (buf.charCodeAt(opt_offset++) << 24) |
                (buf.charCodeAt(opt_offset++) << 16) |
                (buf.charCodeAt(opt_offset++) << 8) |
                (buf.charCodeAt(opt_offset++));
        }
    } else {
        for (i = 0; i < 16; i++) {
            W[i] = (buf[opt_offset++] << 24) |
                (buf[opt_offset++] << 16) |
                (buf[opt_offset++] << 8) |
                (buf[opt_offset++]);
        }
    }

    // expand to 80 words
    for (i = 16; i < 80; i++) {
        t = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];
        W[i] = ((t << 1) | (t >>> 31)) & 0xffffffff;
    }

    var a = this.chain_[0];
    var b = this.chain_[1];
    var c = this.chain_[2];
    var d = this.chain_[3];
    var e = this.chain_[4];
    var f, k;

    // TODO(user): Try to unroll this loop to speed up the computation.
    for (i = 0; i < 80; i++) {
        if (i < 40) {
            if (i < 20) {
                f = d ^ (b & (c ^ d));
                k = 0x5a827999;
            } else {
                f = b ^ c ^ d;
                k = 0x6ed9eba1;
            }
        } else {
            if (i < 60) {
                f = (b & c) | (d & (b | c));
                k = 0x8f1bbcdc;
            } else {
                f = b ^ c ^ d;
                k = 0xca62c1d6;
            }
        }

        t = (((a << 5) | (a >>> 27)) + f + e + k + W[i]) & 0xffffffff;
        e = d;
        d = c;
        c = ((b << 30) | (b >>> 2)) & 0xffffffff;
        b = a;
        a = t;
    }

    this.chain_[0] = (this.chain_[0] + a) & 0xffffffff;
    this.chain_[1] = (this.chain_[1] + b) & 0xffffffff;
    this.chain_[2] = (this.chain_[2] + c) & 0xffffffff;
    this.chain_[3] = (this.chain_[3] + d) & 0xffffffff;
    this.chain_[4] = (this.chain_[4] + e) & 0xffffffff;
};


/** @override */
sha1.prototype.update = function(bytes, opt_length) {
    if (opt_length === undefined) {
        opt_length = bytes.length;
    }

    var lengthMinusBlock = opt_length - 64;
    var n = 0;
    // Using local instead of member variables gives ~5% speedup on Firefox 16.
    var buf = this.buf_;
    var inbuf = this.inbuf_;

    // The outer while loop should execute at most twice.
    while (n < opt_length) {
        // When we have no data in the block to top up, we can directly process the
        // input buffer (assuming it contains sufficient data). This gives ~25%
        // speedup on Chrome 23 and ~15% speedup on Firefox 16, but requires that
        // the data is provided in large chunks (or in multiples of 64 bytes).
        if (inbuf === 0) {
            while (n <= lengthMinusBlock) {
                this.compress_(bytes, n);
                n += 64;
            }
        }

        if (typeof(bytes) === 'string') {
            while (n < opt_length) {
                buf[inbuf++] = bytes.charCodeAt(n++);
                if (inbuf == 64) {
                    this.compress_(buf);
                    inbuf = 0;
                    // Jump to the outer loop so we use the full-block optimization.
                    break;
                }
            }
        } else {
            while (n < opt_length) {
                buf[inbuf++] = bytes[n++];
                if (inbuf == 64) {
                    this.compress_(buf);
                    inbuf = 0;
                    // Jump to the outer loop so we use the full-block optimization.
                    break;
                }
            }
        }
    }

    this.inbuf_ = inbuf;
    this.total_ += opt_length;
};


/** @override */
sha1.prototype.digest = function() {
    var digest = [];
    var totalBits = this.total_ * 8;

    // Add pad 0x80 0x00*.
    if (this.inbuf_ < 56) {
        this.update(this.pad_, 56 - this.inbuf_);
    } else {
        this.update(this.pad_, 64 - (this.inbuf_ - 56));
    }

    // Add # bits.
    for (var i = 63; i >= 56; i--) {
        this.buf_[i] = totalBits & 255;
        totalBits /= 256; // Don't use bit-shifting here!
    }

    this.compress_(this.buf_);

    var n = 0;
    for (i = 0; i < 5; i++) {
        for (var j = 24; j >= 0; j -= 8) {
            digest[n++] = (this.chain_[i] >> j) & 255;
        }
    }

    return digest;
};

sha1.hexString = function(digest) {
    var res = "",
        i;
    for (i = 0; i < digest.length; i++) {
        res = res.concat(digest[i].toString(16));
    }
    return res;
};

sha1.number = function(digest) {
    var value = 0,
        i;
    for (i = digest.length - 1; i >= 0; i--) {
        value = (value * 256) + digest[i];
    }
    return value;
};

sha1.bigInteger = function(digest) {
    var value = BigInteger(),
        i,
        k = 0,
        pows = ['1', '256', '65536', '16777216', '4294967296', '1099511627776', '281474976710656', '72057594037927936', '18446744073709551616', '4722366482869645213696', '1208925819614629174706176', '309485009821345068724781056', '79228162514264337593543950336', '20282409603651670423947251286016', '5192296858534827628530496329220096', '1329227995784915872903807060280344576', '340282366920938463463374607431768211456', '87112285931760246646623899502532662132736', '22300745198530623141535718272648361505980416', '5708990770823839524233143877797980545530986496'];
    for (i = digest.length - 1; i >= 0; i--) {
        value = value.add(new BigInteger(pows[k++]).multiply(digest[i]));
    }
    return value;
};

sha1.bigIntHash = function(val) {
    var _sha1 = new sha1();
    _sha1.update(val);
    return sha1.bigInteger(_sha1.digest());
};

if (typeof(module) !== 'undefined') {
    module.exports = sha1;
}

},{"./BigInteger":15}],17:[function(require,module,exports){
(function (process){
/*!
 * async
 * https://github.com/caolan/async
 *
 * Copyright 2010-2014 Caolan McMahon
 * Released under the MIT license
 */
/*jshint onevar: false, indent:4 */
/*global setImmediate: false, setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root, previous_async;

    root = this;
    if (root != null) {
      previous_async = root.async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// cross-browser compatiblity functions ////

    var _toString = Object.prototype.toString;

    var _isArray = Array.isArray || function (obj) {
        return _toString.call(obj) === '[object Array]';
    };

    var _each = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _each(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        if (typeof setImmediate === 'function') {
            async.nextTick = function (fn) {
                // not a direct alias for IE10 compatibility
                setImmediate(fn);
            };
            async.setImmediate = async.nextTick;
        }
        else {
            async.nextTick = function (fn) {
                setTimeout(fn, 0);
            };
            async.setImmediate = async.nextTick;
        }
    }
    else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== 'undefined') {
            async.setImmediate = function (fn) {
              // not a direct alias for IE10 compatibility
              setImmediate(fn);
            };
        }
        else {
            async.setImmediate = async.nextTick;
        }
    }

    async.each = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(done) );
        });
        function done(err) {
          if (err) {
              callback(err);
              callback = function () {};
          }
          else {
              completed += 1;
              if (completed >= arr.length) {
                  callback();
              }
          }
        }
    };
    async.forEach = async.each;

    async.eachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback();
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };
    async.forEachSeries = async.eachSeries;

    async.eachLimit = function (arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
    };
    async.forEachLimit = async.eachLimit;

    var _eachLimit = function (limit) {

        return function (arr, iterator, callback) {
            callback = callback || function () {};
            if (!arr.length || limit <= 0) {
                return callback();
            }
            var completed = 0;
            var started = 0;
            var running = 0;

            (function replenish () {
                if (completed >= arr.length) {
                    return callback();
                }

                while (running < limit && started < arr.length) {
                    started += 1;
                    running += 1;
                    iterator(arr[started - 1], function (err) {
                        if (err) {
                            callback(err);
                            callback = function () {};
                        }
                        else {
                            completed += 1;
                            running -= 1;
                            if (completed >= arr.length) {
                                callback();
                            }
                            else {
                                replenish();
                            }
                        }
                    });
                }
            })();
        };
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.each].concat(args));
        };
    };
    var doParallelLimit = function(limit, fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.eachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        if (!callback) {
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err) {
                    callback(err);
                });
            });
        } else {
            var results = [];
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err, v) {
                    results[x.index] = v;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);
    async.mapLimit = function (arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
    };

    var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
    };

    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.eachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        var remainingTasks = keys.length
        if (!remainingTasks) {
            return callback();
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            remainingTasks--
            _each(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (!remainingTasks) {
                var theCallback = callback;
                // prevent final callback from calling itself if it errors
                callback = function () {};

                theCallback(null, results);
            }
        });

        _each(keys, function (k) {
            var task = _isArray(tasks[k]) ? tasks[k]: [tasks[k]];
            var taskCallback = function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                if (err) {
                    var safeResults = {};
                    _each(_keys(results), function(rkey) {
                        safeResults[rkey] = results[rkey];
                    });
                    safeResults[k] = args;
                    callback(err, safeResults);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    results[k] = args;
                    async.setImmediate(taskComplete);
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.retry = function(times, task, callback) {
        var DEFAULT_TIMES = 5;
        var attempts = [];
        // Use defaults if times not passed
        if (typeof times === 'function') {
            callback = task;
            task = times;
            times = DEFAULT_TIMES;
        }
        // Make sure times is a number
        times = parseInt(times, 10) || DEFAULT_TIMES;
        var wrappedTask = function(wrappedCallback, wrappedResults) {
            var retryAttempt = function(task, finalAttempt) {
                return function(seriesCallback) {
                    task(function(err, result){
                        seriesCallback(!err || finalAttempt, {err: err, result: result});
                    }, wrappedResults);
                };
            };
            while (times) {
                attempts.push(retryAttempt(task, !(times-=1)));
            }
            async.series(attempts, function(done, data){
                data = data[data.length - 1];
                (wrappedCallback || callback)(data.err, data.result);
            });
        }
        // If a callback is passed, run this as a controll flow
        return callback ? wrappedTask() : wrappedTask
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (!_isArray(tasks)) {
          var err = new Error('First argument to waterfall must be an array of functions');
          return callback(err);
        }
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback.apply(null, arguments);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.setImmediate(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            eachfn.each(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.parallel = function (tasks, callback) {
        _parallel({ map: async.map, each: async.each }, tasks, callback);
    };

    async.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.eachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doWhilst = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (test.apply(null, args)) {
                async.doWhilst(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doUntil = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (!test.apply(null, args)) {
                async.doUntil(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _insert(q, data, pos, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  callback: typeof callback === 'function' ? callback : null
              };

              if (pos) {
                q.tasks.unshift(item);
              } else {
                q.tasks.push(item);
              }

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            started: false,
            paused: false,
            push: function (data, callback) {
              _insert(q, data, false, callback);
            },
            kill: function () {
              q.drain = null;
              q.tasks = [];
            },
            unshift: function (data, callback) {
              _insert(q, data, true, callback);
            },
            process: function () {
                if (!q.paused && workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if (q.empty && q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    var next = function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if (q.drain && q.tasks.length + workers === 0) {
                            q.drain();
                        }
                        q.process();
                    };
                    var cb = only_once(next);
                    worker(task.data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            },
            idle: function() {
                return q.tasks.length + workers === 0;
            },
            pause: function () {
                if (q.paused === true) { return; }
                q.paused = true;
                q.process();
            },
            resume: function () {
                if (q.paused === false) { return; }
                q.paused = false;
                q.process();
            }
        };
        return q;
    };
    
    async.priorityQueue = function (worker, concurrency) {
        
        function _compareTasks(a, b){
          return a.priority - b.priority;
        };
        
        function _binarySearch(sequence, item, compare) {
          var beg = -1,
              end = sequence.length - 1;
          while (beg < end) {
            var mid = beg + ((end - beg + 1) >>> 1);
            if (compare(item, sequence[mid]) >= 0) {
              beg = mid;
            } else {
              end = mid - 1;
            }
          }
          return beg;
        }
        
        function _insert(q, data, priority, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  priority: priority,
                  callback: typeof callback === 'function' ? callback : null
              };
              
              q.tasks.splice(_binarySearch(q.tasks, item, _compareTasks) + 1, 0, item);

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }
        
        // Start with a normal queue
        var q = async.queue(worker, concurrency);
        
        // Override push to accept second parameter representing priority
        q.push = function (data, priority, callback) {
          _insert(q, data, priority, callback);
        };
        
        // Remove unshift function
        delete q.unshift;

        return q;
    };

    async.cargo = function (worker, payload) {
        var working     = false,
            tasks       = [];

        var cargo = {
            tasks: tasks,
            payload: payload,
            saturated: null,
            empty: null,
            drain: null,
            drained: true,
            push: function (data, callback) {
                if (!_isArray(data)) {
                    data = [data];
                }
                _each(data, function(task) {
                    tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    cargo.drained = false;
                    if (cargo.saturated && tasks.length === payload) {
                        cargo.saturated();
                    }
                });
                async.setImmediate(cargo.process);
            },
            process: function process() {
                if (working) return;
                if (tasks.length === 0) {
                    if(cargo.drain && !cargo.drained) cargo.drain();
                    cargo.drained = true;
                    return;
                }

                var ts = typeof payload === 'number'
                            ? tasks.splice(0, payload)
                            : tasks.splice(0, tasks.length);

                var ds = _map(ts, function (task) {
                    return task.data;
                });

                if(cargo.empty) cargo.empty();
                working = true;
                worker(ds, function () {
                    working = false;

                    var args = arguments;
                    _each(ts, function (data) {
                        if (data.callback) {
                            data.callback.apply(null, args);
                        }
                    });

                    process();
                });
            },
            length: function () {
                return tasks.length;
            },
            running: function () {
                return working;
            }
        };
        return cargo;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _each(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                async.nextTick(function () {
                    callback.apply(null, memo[key]);
                });
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

    async.times = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.map(counter, iterator, callback);
    };

    async.timesSeries = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.mapSeries(counter, iterator, callback);
    };

    async.seq = function (/* functions... */) {
        var fns = arguments;
        return function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            async.reduce(fns, args, function (newargs, fn, cb) {
                fn.apply(that, newargs.concat([function () {
                    var err = arguments[0];
                    var nextargs = Array.prototype.slice.call(arguments, 1);
                    cb(err, nextargs);
                }]))
            },
            function (err, results) {
                callback.apply(that, [err].concat(results));
            });
        };
    };

    async.compose = function (/* functions... */) {
      return async.seq.apply(null, Array.prototype.reverse.call(arguments));
    };

    var _applyEach = function (eachfn, fns /*args...*/) {
        var go = function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            return eachfn(fns, function (fn, cb) {
                fn.apply(that, args.concat([cb]));
            },
            callback);
        };
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            return go.apply(this, args);
        }
        else {
            return go;
        }
    };
    async.applyEach = doParallel(_applyEach);
    async.applyEachSeries = doSeries(_applyEach);

    async.forever = function (fn, callback) {
        function next(err) {
            if (err) {
                if (callback) {
                    return callback(err);
                }
                throw err;
            }
            fn(next);
        }
        next();
    };

    // Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    // AMD / RequireJS
    else if (typeof define !== 'undefined' && define.amd) {
        define([], function () {
            return async;
        });
    }
    // included directly via <script> tag
    else {
        root.async = async;
    }

}());

}).call(this,require("FWaASH"))
},{"FWaASH":19}],18:[function(require,module,exports){
/*!
  * Bowser - a browser detector
  * https://github.com/ded/bowser
  * MIT License | (c) Dustin Diaz 2014
  */

!function (name, definition) {
  if (typeof module != 'undefined' && module.exports) module.exports['browser'] = definition()
  else if (typeof define == 'function') define(definition)
  else this[name] = definition()
}('bowser', function () {
  /**
    * See useragents.js for examples of navigator.userAgent
    */

  var t = true

  function detect(ua) {

    function getFirstMatch(regex) {
      var match = ua.match(regex);
      return (match && match.length > 1 && match[1]) || '';
    }

    var iosdevice = getFirstMatch(/(ipod|iphone|ipad)/i).toLowerCase()
      , likeAndroid = /like android/i.test(ua)
      , android = !likeAndroid && /android/i.test(ua)
      , versionIdentifier = getFirstMatch(/version\/(\d+(\.\d+)?)/i)
      , tablet = /tablet/i.test(ua)
      , mobile = !tablet && /[^-]mobi/i.test(ua)
      , result

    if (/opera|opr/i.test(ua)) {
      result = {
        name: 'Opera'
      , opera: t
      , version: versionIdentifier || getFirstMatch(/(?:opera|opr)[\s\/](\d+(\.\d+)?)/i)
      }
    }
    else if (/windows phone/i.test(ua)) {
      result = {
        name: 'Windows Phone'
      , windowsphone: t
      , msie: t
      , version: getFirstMatch(/iemobile\/(\d+(\.\d+)?)/i)
      }
    }
    else if (/msie|trident/i.test(ua)) {
      result = {
        name: 'Internet Explorer'
      , msie: t
      , version: getFirstMatch(/(?:msie |rv:)(\d+(\.\d+)?)/i)
      }
    }
    else if (/chrome|crios|crmo/i.test(ua)) {
      result = {
        name: 'Chrome'
      , chrome: t
      , version: getFirstMatch(/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i)
      }
    }
    else if (iosdevice) {
      result = {
        name : iosdevice == 'iphone' ? 'iPhone' : iosdevice == 'ipad' ? 'iPad' : 'iPod'
      }
      // WTF: version is not part of user agent in web apps
      if (versionIdentifier) {
        result.version = versionIdentifier
      }
    }
    else if (/sailfish/i.test(ua)) {
      result = {
        name: 'Sailfish'
      , sailfish: t
      , version: getFirstMatch(/sailfish\s?browser\/(\d+(\.\d+)?)/i)
      }
    }
    else if (/seamonkey\//i.test(ua)) {
      result = {
        name: 'SeaMonkey'
      , seamonkey: t
      , version: getFirstMatch(/seamonkey\/(\d+(\.\d+)?)/i)
      }
    }
    else if (/firefox|iceweasel/i.test(ua)) {
      result = {
        name: 'Firefox'
      , firefox: t
      , version: getFirstMatch(/(?:firefox|iceweasel)[ \/](\d+(\.\d+)?)/i)
      }
      if (/\((mobile|tablet);[^\)]*rv:[\d\.]+\)/i.test(ua)) {
        result.firefoxos = t
      }
    }
    else if (/silk/i.test(ua)) {
      result =  {
        name: 'Amazon Silk'
      , silk: t
      , version : getFirstMatch(/silk\/(\d+(\.\d+)?)/i)
      }
    }
    else if (android) {
      result = {
        name: 'Android'
      , version: versionIdentifier
      }
    }
    else if (/phantom/i.test(ua)) {
      result = {
        name: 'PhantomJS'
      , phantom: t
      , version: getFirstMatch(/phantomjs\/(\d+(\.\d+)?)/i)
      }
    }
    else if (/blackberry|\bbb\d+/i.test(ua) || /rim\stablet/i.test(ua)) {
      result = {
        name: 'BlackBerry'
      , blackberry: t
      , version: versionIdentifier || getFirstMatch(/blackberry[\d]+\/(\d+(\.\d+)?)/i)
      }
    }
    else if (/(web|hpw)os/i.test(ua)) {
      result = {
        name: 'WebOS'
      , webos: t
      , version: versionIdentifier || getFirstMatch(/w(?:eb)?osbrowser\/(\d+(\.\d+)?)/i)
      };
      /touchpad\//i.test(ua) && (result.touchpad = t)
    }
    else if (/bada/i.test(ua)) {
      result = {
        name: 'Bada'
      , bada: t
      , version: getFirstMatch(/dolfin\/(\d+(\.\d+)?)/i)
      };
    }
    else if (/tizen/i.test(ua)) {
      result = {
        name: 'Tizen'
      , tizen: t
      , version: getFirstMatch(/(?:tizen\s?)?browser\/(\d+(\.\d+)?)/i) || versionIdentifier
      };
    }
    else if (/safari/i.test(ua)) {
      result = {
        name: 'Safari'
      , safari: t
      , version: versionIdentifier
      }
    }
    else result = {}

    // set webkit or gecko flag for browsers based on these engines
    if (/(apple)?webkit/i.test(ua)) {
      result.name = result.name || "Webkit"
      result.webkit = t
      if (!result.version && versionIdentifier) {
        result.version = versionIdentifier
      }
    } else if (!result.opera && /gecko\//i.test(ua)) {
      result.name = result.name || "Gecko"
      result.gecko = t
      result.version = result.version || getFirstMatch(/gecko\/(\d+(\.\d+)?)/i)
    }

    // set OS flags for platforms that have multiple browsers
    if (android || result.silk) {
      result.android = t
    } else if (iosdevice) {
      result[iosdevice] = t
      result.ios = t
    }

    // OS version extraction
    var osVersion = '';
    if (iosdevice) {
      osVersion = getFirstMatch(/os (\d+([_\s]\d+)*) like mac os x/i);
      osVersion = osVersion.replace(/[_\s]/g, '.');
    } else if (android) {
      osVersion = getFirstMatch(/android[ \/-](\d+(\.\d+)*)/i);
    } else if (result.windowsphone) {
      osVersion = getFirstMatch(/windows phone (?:os)?\s?(\d+(\.\d+)*)/i);
    } else if (result.webos) {
      osVersion = getFirstMatch(/(?:web|hpw)os\/(\d+(\.\d+)*)/i);
    } else if (result.blackberry) {
      osVersion = getFirstMatch(/rim\stablet\sos\s(\d+(\.\d+)*)/i);
    } else if (result.bada) {
      osVersion = getFirstMatch(/bada\/(\d+(\.\d+)*)/i);
    } else if (result.tizen) {
      osVersion = getFirstMatch(/tizen[\/\s](\d+(\.\d+)*)/i);
    }
    if (osVersion) {
      result.osversion = osVersion;
    }

    // device type extraction
    var osMajorVersion = osVersion.split('.')[0];
    if (tablet || iosdevice == 'ipad' || (android && (osMajorVersion == 3 || (osMajorVersion == 4 && !mobile))) || result.silk) {
      result.tablet = t
    } else if (mobile || iosdevice == 'iphone' || iosdevice == 'ipod' || android || result.blackberry || result.webos || result.bada) {
      result.mobile = t
    }

    // Graded Browser Support
    // http://developer.yahoo.com/yui/articles/gbs
    if ((result.msie && result.version >= 10) ||
        (result.chrome && result.version >= 20) ||
        (result.firefox && result.version >= 20.0) ||
        (result.safari && result.version >= 6) ||
        (result.opera && result.version >= 10.0) ||
        (result.ios && result.osversion && result.osversion.split(".")[0] >= 6)
        ) {
      result.a = t;
    }
    else if ((result.msie && result.version < 10) ||
        (result.chrome && result.version < 20) ||
        (result.firefox && result.version < 20.0) ||
        (result.safari && result.version < 6) ||
        (result.opera && result.version < 10.0) ||
        (result.ios && result.osversion && result.osversion.split(".")[0] < 6)
        ) {
      result.c = t
    } else result.x = t

    return result
  }

  var bowser = detect(typeof navigator !== 'undefined' ? navigator.userAgent : '')


  /*
   * Set our detect method to the main bowser object so we can
   * reuse it to test other user agents.
   * This is needed to implement future tests.
   */
  bowser._detect = detect;

  return bowser
});

},{}],19:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}]},{},[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16])