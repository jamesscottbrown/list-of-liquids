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
    var nodes = [
          {id: 0, type: "well", label: "Sample"},
          {id: 1, type: "volume", label: "10 ml"},
          {id: 2, type: "cross", label: "cross"},
          {id: 3, type: "aliquot", label: "Aliquot"}],

        lastNodeId = nodes.length - 1,
        links = [
          {source: nodes[0], target: nodes[2]},
          {source: nodes[1], target: nodes[2]},
          {source: nodes[2], target: nodes[3]}
        ];

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
        circle = svg.append('svg:g').selectAll('g');

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
    }

  // update graph (called when needed)
    function restart() {

      var constraints = [];
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        constraints.push({"axis": "y", "left": link.source.id, "right": link.target.id, "gap": 25})
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
      // NB: the function arg is crucial here! nodes are known by id, not by index!
      circle = circle.data(nodes, function (d) {
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
            // select node
            mousedown_node = d;
            if (mousedown_node === selected_node) selected_node = null;
            else selected_node = mousedown_node;
            selected_link = null;

            // reposition drag line
            drag_line
                .style('marker-end', 'url(#end-arrow)')
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
            var source, target, direction;
            source = mousedown_node;
            target = mouseup_node;

            var link;
            link = links.filter(function (l) {
              return (l.source === source && l.target === target);
            })[0];

            if (link) {
              link[direction] = true;
            } else {
              link = {source: source, target: target};
              link[direction] = true;
              links.push(link);
            }

            // select new link
            selected_link = link;
            selected_node = null;
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

      // remove old nodes
      circle.exit().remove();

      // set the graph in motion
      force.start();
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

  // app starts here
    svg.on('mousemove', mousemove)
        .on('mouseup', mouseup);

    d3.select(window)
        .on('keydown', keydown)
        .on('keyup', keyup);

    restart();

    return {addWellNode: addWellNode, addVolumeNode: addVolumeNode, clearEverything: clearEverything};
}