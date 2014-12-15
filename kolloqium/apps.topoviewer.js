TopologyViewer = function(bopclient, topoProtocol, svgId) {
    if(!(this instanceof TopologyViewer)) {
        return new TopologyViewer(bopclient, topoProtocol, svgId);
    }

    this._bopclient = bopclient;
    this._id = bopclient._router.id.toString().replace(/^[0]+/g,"");
    this._topoProtocol = topoProtocol;
    this._topoProtocol.onmessage = this._onTopoResponse.bind(this);
    this._svgId = svgId;

    this._interval;
    this._messageQueue = new Array(100);
    this._nodes;
    this._links;
    this.reset();
    
    return this;
};

TopologyViewer.prototype = {
    reset: function() {
        clearTimeout(this._interval);
        this._interval = false;
        this._messageQueue = new Array(100);
        this._nodes = null;
        this._links = null;
    },
    startAutoDiscovery: function() {
        if (this._interval === false) {
            this.update();
            this._interval = setInterval(this.update.bind(this), 5000);
        }
    },
    stopAutoDiscovery: function() {
        if (this._interval) {
            clearTimeout(this._interval);
            this._interval = false;
        }
    },
    update: function() {
    	this.reset();
        this._topoProtocol.sendRequest();
        setTimeout(function(){
            this._render();
        }.bind(this), 1000);
    },
    _onTopoResponse: function(msg, bopid) {
        // console.log('got response from: ' + from + ', peers: ' + connected_peers.toString());
        var connections = [];
        /*msg.connected_peers.forEach(function(connection) {
        	connections.push(connection.successor.replace(/^[0]+/g,""));
        });*/
		msg.connected_peers.forEach(function(connection) {
        	connections.push(connection.replace(/^[0]+/g,""));
        });

        this._messageQueue.shift();
        this._messageQueue.push({
            from: msg.from.replace(/^[0]+/g,""),
            connected_peers: connections
        });
        console.log(this._messageQueue);
    },
    _render: function() {
    	var self = this;
        self._links = [];
        self._nodes = [];

        // extract active nodes from queue
        var i, j, activeNodes = [];
        for (i=0; i<self._messageQueue.length; i++) {
          if (typeof(self._messageQueue[i]) !== 'undefined') {
            activeNodes.push(self._messageQueue[i].from);
            for (j=0; j<self._messageQueue[i].connected_peers.length; j++) {
                activeNodes.push(self._messageQueue[i].connected_peers[j]);
                findLinkOrAdd(self._links, self._nodes, self._messageQueue[i].from, self._messageQueue[i].connected_peers[j]);
            }
          }
        }
        // remove inactive nodes if its not me
        for (i=0; i<self._nodes.length; i++) {
            if (self._nodes[i].id !== self.id && activeNodes.indexOf(self._nodes[i].id) === -1) {
                console.log('removing ' + self._nodes[i].id);
                self._nodes.splice(i, 1);
            }
        }

        // add unknown nodes
        for (i=0; i<activeNodes.length; i++) {
            updateNodeOrAdd(self._nodes, activeNodes[i]);
        }
        
        cleanLinks(self._links, self._nodes);
        self._updateTopo();
        return;
        
        /**
         * Helper Functions 
         *
         */
        function updateNodeOrAdd(nodes, nodeId) {
          var i, node;
          if (nodeId === self.id) {
            return 0;
          }
          for (i=0; i<nodes.length; i++) {
            if (nodes[i].id === nodeId) {
              return i;
            }
          }
          node = {id:nodeId, group:2};
          return nodes.push(node) - 1;
        }

        function findLinkOrAdd(links, nodes, sourceId, targetId) {
          var i;
          for (i=0; i<links.length; i++) {
            if ((links[i].sourceId === sourceId && links[i].targetId === targetId) ||
              (links[i].sourceId === targetId && links[i].targetId === sourceId)) {
              // link exists
              return;
            }
          }
          links.push({
            sourceId: sourceId,
            source: updateNodeOrAdd(nodes, sourceId),
            targetId: targetId,
            target: updateNodeOrAdd(nodes, targetId),
            value: 10
          });
        }
        
        function cleanLinks(links, nodes) {
            var i = links.length;
            while (i--) {
                var sid = links[i].sourceId;
                var tid = links[i].targetId;
                if (!(nodeExists(nodes, sid) && nodeExists(nodes, tid))) {
                    links.splice(i, 1);
                }
            }
            function nodeExists(nodes, nodeId) {
                var j;
                for (j=0; j<nodes.length; j++) {
                    if (nodes[j].id === nodeId) {
                        return nodes[j];
                    }
                  }
                return false;
            }
        }
    },/**render*/
    _updateTopo: function() {
    	console.log();
        var width = $(this._svgId).width(),
            height = 500;

        var color = d3.scale.category20();

        var force = d3.layout.force()
            .charge(-1000)
            .linkDistance(60)
            .linkStrength(1) // set to <1 for finger table entries
            .size([width, height]);

        $(this._svgId).html('');
        var svg = d3.select(this._svgId)
            .attr("viewBox", "0 0 " + width + " " + height )
            .attr("preserveAspectRatio", "xMidYMid meet");

        force.nodes(this._nodes)
            .links(this._links)
            .start();

        var link = svg.selectAll(".link")
            .data(this._links)
            .enter().append("line")
            .attr("class", "link")
            .style("stroke-width", function(d) { return Math.sqrt(d.value); });

        var node = svg.selectAll(".peers")
            .data(this._nodes)
            .enter()
            .append("circle")
            .attr("class", "node")
            .attr("r", 18)
            .style("fill", function(d) { return color(d.group); })
            .call(force.drag);

        node.append("title")
            .text(function(d) { return d.id; });

        force.on("tick", function() {
            link.attr("x1", function(d,i) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; });

            node.attr("cx", function(d) { return d.x; })
                .attr("cy", function(d) { return d.y; });
        });
    }
};
