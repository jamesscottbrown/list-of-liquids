function network_editor () {
  // set up SVG for D3
    var width = 960,
        height = 500;

    var svg = d3.select('#network')
        .append('svg')
        .attr('oncontextmenu', 'return false;')
        .attr('width', width)
        .attr('height', height);

  // set up initial nodes and links
    var nodes, lastNodeId, links;

    if (protocol_string){

        console.log(protocol_string);
        var obj = JSON.parse(protocol_string);

        nodes = obj.nodes;

        var nodePosition = [];
        for (var i = 0; i < nodes.length; i++){
            nodePosition[ nodes[i].id ] = i;
        }

        links = [];
        for (i=0; i<obj.links.length; i++){
            var link = obj.links[i];
            links.push({source: nodes[nodePosition[link.source_id]], target: nodes[nodePosition[link.target_id]]});
        }

    } else {
        nodes = [
          {id: 0, type: "well", label: "Sample"},
          {id: 1, type: "volume", label: "10 ml"},
          {id: 2, type: "cross", label: "cross"},
          {id: 3, type: "aliquot", label: "Aliquot"}];

        links = [
          {source: nodes[0], target: nodes[2]},
          {source: nodes[1], target: nodes[2]},
          {source: nodes[2], target: nodes[3]}
        ];
    }
    lastNodeId = nodes.length - 1;

    var force = cola.d3adaptor()
        .linkDistance(150)
        .size([width, height])
        .nodes(nodes)
        .links(links)
        .on('tick', tick);

  // define arrow markers for graph links
    svg.append('svg:defs').append('svg:marker')
        .attr('id', 'end-arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 6)
        .attr('markerWidth', 3)
        .attr('markerHeight', 3)
        .attr('orient', 'auto')
        .append('svg:path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#000');

  // line displayed when dragging new nodes
    var drag_line = svg.append('svg:path')
        .attr('class', 'link dragline hidden')
        .attr('d', 'M0,0L0,0');

  // handles to link and node element groups
    var path = svg.append('svg:g').selectAll('path'),
        circle = svg.append('svg:g').selectAll('g'),
        rect = svg.append('svg:g').selectAll('g');

  // mouse event vars
    var selected_node = null,
        selected_link = null,
        mousedown_link = null,
        mousedown_node = null,
        mouseup_node = null;

    function resetMouseVars() {
      mousedown_node = null;
      mouseup_node = null;
      mousedown_link = null;
    }

  // update force layout (called automatically each iteration)
    function tick() {
      // draw directed edges with proper padding from node centers
      path.attr('d', function (d) {
        var deltaX = d.target.x - d.source.x,
            deltaY = d.target.y - d.source.y,
            dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
            normX = deltaX / dist,
            normY = deltaY / dist,
            sourcePadding = 12,
            targetPadding = 17,
            sourceX = d.source.x + (sourcePadding * normX),
            sourceY = d.source.y + (sourcePadding * normY),
            targetX = d.target.x - (targetPadding * normX),
            targetY = d.target.y - (targetPadding * normY);
        return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
      });

      circle.attr('transform', function (d) {
        return 'translate(' + d.x + ',' + d.y + ')';
      });

        rect.attr('transform', function (d) {
        return 'translate(' + (d.x -12) + ',' + (d.y-12) + ')';
      });

    }

  // update graph (called when needed)
    function restart() {

        // create an array mapping from node id to index in the nodes array
        var nodePosition = [];
        for (var i = 0; i < nodes.length; i++){
            nodePosition[ nodes[i].id ] = i;
        }

      var constraints = [];
      for (i = 0; i < links.length; i++) {
        var link = links[i];
        constraints.push({"axis": "y", "left": nodePosition[link.source.id],
                          "right": nodePosition[link.target.id], "gap": 25})
      }
      force.constraints(constraints);

      // path (link) group
      path = path.data(links);

      // update existing links
      path.classed('selected', function (d) {
            return d === selected_link;
          })
          .style('marker-start', '')
          .style('marker-end', 'url(#end-arrow)');

      // add new links
      path.enter().append('svg:path')
          .attr('class', 'link')
          .classed('selected', function (d) {
            return d === selected_link;
          })
          .style('marker-start', '')
          .style('marker-end', 'url(#end-arrow)')
          .on('mousedown', function (d) {
            // select link
            mousedown_link = d;
            if (mousedown_link === selected_link) selected_link = null;
            else selected_link = mousedown_link;
            selected_node = null;
            restart();
          });

      // remove old links
      path.exit().remove();

      // circle (node) group
        var process_node_types = ['zip', 'cross', 'add', 'prod'];
        var circular_nodes = nodes.filter(function(d){ return process_node_types.indexOf(d.type) == -1 });
        var process_nodes = nodes.filter(function(d){ return process_node_types.indexOf(d.type) != -1 });

      // NB: the function arg is crucial here! nodes are known by id, not by index!
      circle = circle.data(circular_nodes, function (d) {
        return d.id;
      });

      // update existing nodes (selected visual state)
      circle.selectAll('circle')
          .style('opacity', function (d) {
            return (d === selected_node) ? '1' : '0.5';
          });

      // add new nodes
      var g = circle.enter().append('svg:g');

      g.append('svg:circle')
          .attr('class', 'node')
          .classed('well', function (d) {
            return d.type == "well"
          })
          .classed('volume', function (d) {
            return d.type == "volume"
          })
          .classed('cross', function (d) {
            return d.type == "cross"
          })
          .classed('zip', function (d) {
            return d.type == "zip"
          })
          .classed('aliquot', function (d) {
            return d.type == "aliquot"
          })

          .attr('r', 12)
          .style('opacity', function (d) {
            return (d === selected_node) ? '1' : '0.5';
          })
          .on('mouseover', function (d) {
            if (!mousedown_node || d === mousedown_node) return;
            d3.select(this).attr('transform', 'scale(1.1)'); // enlarge target node
          })
          .on('mouseout', function (d) {
            if (!mousedown_node || d === mousedown_node) return;
            d3.select(this).attr('transform', ''); // unenlarge target node
          })
          .on('mousedown', function (d) {

              // ignore right click
              if (("which" in d3.event && d3.event.which == 3) // Firefox, WebKit
                  || ("button" in d3.event && d3.event.button == 2))  // IE
                   return;

            // select node
            mousedown_node = d;
            if (mousedown_node === selected_node) selected_node = null;
            else selected_node = mousedown_node;
            selected_link = null;

            // reposition drag line
            drag_line
                .classed('hidden', false)
                .attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + mousedown_node.x + ',' + mousedown_node.y);

            restart();
          })
          .on('mouseup', function (d) {
            if (!mousedown_node) return;

            // needed by FF
            drag_line
                .classed('hidden', true)
                .style('marker-end', '');

            // check for drag-to-self
            mouseup_node = d;
            if (mouseup_node === mousedown_node) {
              resetMouseVars();
              return;
            }

            // unenlarge target node
            d3.select(this).attr('transform', '');

            // add link to graph (update if exists)
            addEdge();
            restart();
          });

      // show node IDs
      g.append('svg:text')
          .attr('x', 0)
          .attr('y', 4)
          .attr('class', 'id')
          .text(function (d) {
            return d.label;
          });


        // Add new 'process' nodes
        // different shape; no ability to drag line from node; context menu

      rect = rect.data(process_nodes, function (d) {
        return d.id;
      });

      // update existing nodes (selected visual state)
      rect.selectAll('rect')
          .style('opacity', function (d) {
            return (d === selected_node) ? '1' : '0.5';
          });

      // add new nodes
      var g2 = rect.enter().append('svg:g');

      g2.append('svg:rect')
          .attr('class', 'node')
          .classed('well', function (d) {
            return d.type == "well"
          })
          .classed('volume', function (d) {
            return d.type == "volume"
          })
          .classed('cross', function (d) {
            return d.type == "cross"
          })
          .classed('zip', function (d) {
            return d.type == "zip"
          })
          .classed('aliquot', function (d) {
            return d.type == "aliquot"
          })

          .attr('width', 24)
          .attr('height', 24)

          .style('opacity', function (d) {
            return (d === selected_node) ? '1' : '0.5';
          })
          .on('mouseover', function (d) {
            if (!mousedown_node || d === mousedown_node) return;
            d3.select(this).attr('transform', 'scale(1.1)'); // enlarge target node
          })
          .on('mouseout', function (d) {
            if (!mousedown_node || d === mousedown_node) return;
            d3.select(this).attr('transform', ''); // unenlarge target node
          })
          .on('mousedown', function (d) {
          })
          .on('mouseup', function (d) {
          })
          .on('contextmenu', d3.contextMenu([{
                title: "FOO",
                action: function(elm, d, i) {console.log(d.type)}
            }]));



      // show node IDs
      g2.append('svg:text')
          .attr('x', 12)
          .attr('y', 4+12)
          .attr('class', 'id')
          .text(function (d) {
            return d.label;
          });


      // remove old nodes
      circle.exit().remove();
      rect.exit().remove();

      // set the graph in motion
      force.start();
    }

    function addEdge(){
        var possible_operations = getPossibleOperators(mousedown_node.type, mouseup_node.type);

        if (possible_operations.length == 0) return;

        var operator = possible_operations[0];
        var productType = getOperationResult(operator, mousedown_node.type, mouseup_node.type);

        var i = nodes.push({id: ++lastNodeId, type: operator, x: width/2, y: height/2, label: operator, parents: [mousedown_node, mouseup_node]});
        var j = nodes.push({id: ++lastNodeId, type: productType, x: width/2, y: height/2, label: productType});
        i--; j--;

        links.push({source: mousedown_node, target: nodes[i]});
        links.push({source: mouseup_node, target: nodes[i]});
        links.push({source: nodes[i], target: nodes[j]});

        selected_link = null;
        selected_node = nodes[i];
    }


    function mousemove() {
      if (!mousedown_node) return;
      drag_line.attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + d3.mouse(this)[0] + ',' + d3.mouse(this)[1]);
      restart();
    }

    function mouseup() {
      if (mousedown_node) {
        drag_line
            .classed('hidden', true)
            .style('marker-end', '');
      }
      svg.classed('active', false);
      resetMouseVars();
    }

    function spliceLinksForNode(node) {
      var toSplice = links.filter(function (l) {
        return (l.source === node || l.target === node);
      });
      toSplice.map(function (l) {
        links.splice(links.indexOf(l), 1);
      });
    }

    function clearEverything() {
      nodes = [];
      links = [];
      lastNodeId = 0;

      force.nodes(nodes).links(links);
      restart();
    }

  // only respond once per keydown
    var lastKeyDown = -1;

    function keydown() {
      d3.event.preventDefault();

      if (lastKeyDown !== -1) return;
      lastKeyDown = d3.event.keyCode;

      if (!selected_node && !selected_link) return;

      if (d3.event.keyCode == 8 || d3.event.keyCode == 46) { // backspace or delete
        if (selected_node) {
          nodes.splice(nodes.indexOf(selected_node), 1);
          spliceLinksForNode(selected_node);
        } else if (selected_link) {
          links.splice(links.indexOf(selected_link), 1);
        }
        selected_link = null;
        selected_node = null;
        restart();
      }
    }

    function keyup() {
      lastKeyDown = -1;
    }

    function addWellNode() {
      nodes.push({id: ++lastNodeId, type: 'well', x: width / 2, y: height / 2, label: prompt('Name:')});
      restart();
    }

    function addVolumeNode() {
      nodes.push({
        id: ++lastNodeId,
        type: 'volume',
        x: width / 2,
        y: height / 2,
        label: 'Volume',
        data: prompt('Volumes:')
      });
      restart();
    }

    function save(){

        // note that we cannot serialise {nodes: nodes, links: links} because of cyclic references
        var node_list = [];
        for (i=0; i<nodes.length; i++){
            var node = nodes[i];
            node_list.push({id: node.id, type: node.type, x: node.x, y: node.y, label: node.label});
        }

        var link_list = [];
        for (i=0; i<links.length; i++){
            var link = links[i];
            link_list.push({source_id: link.source.id, target_id: link.target.id});
        }

        var protocol_string = JSON.stringify({nodes: node_list, links: link_list});
        $.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        url: window.location.href + "/save",
        dataType: 'html',
        async: true,
        data: protocol_string,
        beforeSend: function(xhr, settings) {
            xhr.setRequestHeader("X-CSRFToken", csrf_token);
         },
        success: function (data) { console.log("SUCCESS")},
        error: function (result, textStatus) { console.log(result); console.log(textStatus); }
        })
    }


  // app starts here
    svg.on('mousemove', mousemove)
        .on('mouseup', mouseup);

    d3.select(window)
        .on('keydown', keydown)
        .on('keyup', keyup);

    restart();

    return {addWellNode: addWellNode, addVolumeNode: addVolumeNode, clearEverything: clearEverything, save: save};
}