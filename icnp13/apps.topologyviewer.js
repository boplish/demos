TopologyViewer = function(bopclient, topoProtocol, svgId) {
    if(!(this instanceof TopologyViewer)) {
        return new TopologyViewer(bopclient, topoProtocol, svg);
    }

    this._messageQueue = new Array(100);
    this._bopclient = bopclient;
    this._nodes = [{
        id: this._bopclient.id,
        group:1
    }];
    this._links = [];
    this._topoProtocol = topoProtocol;
    this._topoProtocol.registerCallback(this._onTopoResponse.bind(this));
    this._svgId = svgId;
    this._interval = false;
    
    return this;
};

TopologyViewer.prototype = {
    reset: function() {
        clearTimeout(this._interval);
        this._interval = false;
        this._messageQueue = new Array(100);
        this._render();
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
        this._topoProtocol.sendRequest();
        setTimeout(function(){
            this._render();
        }.bind(this), 1000);
    },
    _onTopoResponse: function(connected_peers, from) {
        // console.log('got response from: ' + from + ', peers: ' + connected_peers.toString());
        this._messageQueue.shift();
        this._messageQueue.push({
            from: from,
            connected_peers: connected_peers
        });
    },
    _render: function() {
        var changed = false;
        // extract active nodes from queue
        var i, j, activeNodes = [];
        for (i=0; i<this._messageQueue.length; i++) {
          if (typeof(this._messageQueue[i]) !== 'undefined') {
            activeNodes.push(this._messageQueue[i].from);
            for (j=0; j<this._messageQueue[i].connected_peers.length; j++) {
                activeNodes.push(this._messageQueue[i].connected_peers[j]);
                findLinkOrAdd(this._links, this._nodes, this._messageQueue[i].from, this._messageQueue[i].connected_peers[j]);
            }
          }
        }
        // remove inactive nodes if its not me
        for (i=0; i<this._nodes.length; i++) {
            if (this._nodes[i].id !== bopclient.id && activeNodes.indexOf(this._nodes[i].id) === -1) {
                console.log('removing ' + this._nodes[i].id);
                this._nodes.splice(i, 1);
                changed = true;
            }
        }

        // add unknown nodes
        for (i=0; i<activeNodes.length; i++) {
            updateNodeOrAdd(this._nodes, activeNodes[i]);
        }
        
        // draw it if something changed or on coin flip
        if (changed || Math.random() < 0.5) {
            cleanLinks(this._links, this._nodes);
            this._updateTopo();
        }
        return;
        
        /**
         * Helper Functions 
         *
         */
        function updateNodeOrAdd(nodes, nodeId) {
          var i, node;
          if (nodeId === bopclient.id) {
            return 0;
          }
          for (i=0; i<nodes.length; i++) {
            if (nodes[i].id === nodeId) {
              return i;
            }
          }
          changed = true;
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
          changed = true;
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
        var width = 1140,
            height = 500;

        var color = d3.scale.category20();

        var force = d3.layout.force()
            .charge(-120)
            .linkDistance(300)
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
