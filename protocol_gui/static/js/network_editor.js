function network_editor () {
  // set up SVG for D3
    var width = 960,
        height = 500;

    var svg = d3.select('#network')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    var process_node_types = ['zip', 'cross', 'add', 'prod', 'process'];

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

        for (i = 0; i < nodes.length; i++){
            if (nodes[i].hasOwnProperty('parentIds')){
                var ind1 = nodePosition[nodes[i].parentIds[0]];
                var ind2 =  nodePosition[nodes[i].parentIds[1]];
                nodes[i].parents = [nodes[ind1], nodes[ind2]];
            }
        }

        links = [];
        for (i=0; i<obj.links.length; i++){
            var link = obj.links[i];
            links.push({source: nodes[nodePosition[link.source_id]], target: nodes[nodePosition[link.target_id]]});
        }

    } else {
        nodes = [
          {id: 0, type: "well", label: "Sample", data: {num_wells: 2}},
          {id: 1, type: "volume", label: "10 ml", data: {}},
          {id: 2, type: "cross", label: "cross", data: {}},
          {id: 3, type: "aliquot", label: "Aliquot", data: {}}];

        links = [
          {source: nodes[0], target: nodes[2]},
          {source: nodes[1], target: nodes[2]},
          {source: nodes[2], target: nodes[3]}
        ];
    }
    lastNodeId = nodes.length - 1;

    var force = cola.d3adaptor()
        .linkDistance(50)
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
        redrawLinks(links);

      // circle (node) group
        var circular_nodes = nodes.filter(function(d){ return process_node_types.indexOf(d.type) == -1 });
        var process_nodes = nodes.filter(function(d){ return process_node_types.indexOf(d.type) != -1 });

        redrawCircularNodes(circular_nodes);
        redrawRectangularNodes(process_nodes);

      force.start();
    }

    function redrawLinks(links){
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

    }

    function redrawCircularNodes(circular_nodes){

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

            updateDescriptionPanel();

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

            // un-enlarge target node
            d3.select(this).attr('transform', '');

            // add link to graph (update if exists)
            addEdge();
            restart();
          })
       .on('contextmenu', d3.contextMenu([{
                    title: 'Delete',
                    action: function(elm, d, i) { deleteNode(d); }
                }])
        );

        // remove old nodes
      circle.exit().remove();

        // update text of existing labels
        circle.selectAll('text')
           .text(function (d) {
            return d.label;
          });


      // show node IDs
      g.append('svg:text')
          .attr('x', 0)
          .attr('y', 4)
          .attr('class', 'id')
          .text(function (d) {
            return d.label;
          });

    }

    function deleteNode(d){

         if (process_node_types.indexOf(d.type) == -1) {

            var formationLink = links.filter( function(l){return l.target.id == d.id; });
            if (formationLink.length){
                // Case I: if this is an object created by process, call deleteNode on process that created it
                deleteNode(formationLink[0].source);
            } else {
                // Case II: this is an object not created by a process
             deleteDownFromNode(d);
            }
         }

        // Case III: this is a process, so delete links to it, then node and children
        else if (process_node_types.indexOf(d.type) != -1) {

            // delete arrows to this process node
            var inLinks = links.filter( function(l){return l.target.id == d.id; });
            for (var i=0; i<inLinks.length; i++){
                links.splice(links.indexOf(inLinks[i]), 1);
            }

            deleteDownFromNode(d);
        }

        restart();
    }


    function deleteDownFromNode(d){

        // delete this node
        var index = nodes.indexOf( nodes.filter(function(n){ return n.id == d.id})[0] );
        nodes.splice(index, 1);

        // delete incoming links
        var inLinks = links.filter( function(l){return l.target.id == d.id; });
        for (var i=0; i<inLinks.length; i++){
            links.splice(links.indexOf(inLinks[i]), 1);
        }

        // delete outgoing links
        var children = [];

        var outLinks = links.filter( function(l){return l.source.id == d.id; });
        for (var i=0; i<outLinks.length; i++){
            children.push(outLinks[i].target);
            links.splice(links.indexOf(outLinks[i]), 1);
        }

        // delete the nodes that outgoing links target
        for (var i=0; i<children.length; i++){
            if (nodes.indexOf(children[i] != -1)){
                deleteDownFromNode(children[i]);
            }
        }
    }

    function redrawRectangularNodes(process_nodes){

        // update existing node labels
        rect.selectAll("text")
            .text(function(d){return d.label; });

        // Add new 'process' nodes
        // different shape; no ability to drag line from node; context menu

      rect = rect.data(process_nodes, function (d) {
        return d.id;
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

          .style('opacity', '0.5')
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
              restart();
            updateDescriptionPanel();
          })
           .on('mouseup', function (d) {
               // nb. no mousedown event registered, so no need to check for drag-to-self
            if (!mousedown_node){ return; }
            mouseup_node = d;

            // un-enlarge target node
            d3.select(this).attr('transform', '');

            // add link to graph (update if exists)
            addEdge();
            restart();
          })

          .on('contextmenu', d3.contextMenu(createOptionsMenu));

      // show node IDs
      g2.append('svg:text')
          .attr('x', 12)
          .attr('y', 4+12)
          .attr('class', 'id')
          .text(function (d) {
            return d.label;
          });

      // remove old nodes
      rect.exit().remove();
    }


    function createOptionsMenu(d){
        var menu = [];

        if (d.type != "process") {
            var operations = ['zip', 'cross', 'add', 'prod'];

            function changeOperation(operation) {
                return function (elm, d, i) {
                    nodes.filter(function (n) {
                        return n.id == d.id
                    })[0].type = operation;
                    nodes.filter(function (n) {
                        return n.id == d.id
                    })[0].label = operation;
                    restart();
                }
            }

            for (var i = 0; i < operations.length; i++) {
                var operation = operations[i];
                if (isValidNewOperation(d, operation)) {
                    menu.push({
                        title: operation,
                        disabled: (operation == d.type),
                        action: changeOperation(operation)
                    })
                }
            }
        }

        menu.push({
				divider: true
			});
        menu.push({
                    title: 'Delete',
                    action: function(elm, d, i) { deleteNode(d); }
                });
        return menu;
    }

    function addEdge(){

        // handle arrow draw from well/aliquot to process (e.g. thermocycle)
        if (mouseup_node.type == "process" && (mousedown_node.type == "aliquot" || mousedown_node.type == "well")){
            links.push({source: mousedown_node, target: mouseup_node});
            selected_node = mouseup_node;
            return;
        }

        var possible_operations = getPossibleOperators(mousedown_node.type, mouseup_node.type);

        if (possible_operations.length == 0) return;

        var operator = possible_operations[0];
        var productType = getOperationResult(operator, mousedown_node.type, mouseup_node.type);

        var i = nodes.push({id: ++lastNodeId, type: operator, x: width/2, y: height/2, label: operator, parents: [mousedown_node, mouseup_node]});
        var j = nodes.push({id: ++lastNodeId, type: productType, x: width/2, y: height/2, label: ""});
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
       d3.select("#info").select("form").remove();
      force.nodes(nodes).links(links);
      restart();
    }

    function addWellNode() {
      nodes.push({id: ++lastNodeId, type: 'well', x: width / 2, y: height / 2, label: prompt('Name:'), data: {num_wells: 1}});
      restart();
    }

    function addProcessNode(){
        var operation = prompt('Operation:');
        nodes.push({id: ++lastNodeId, type: 'process', x: width / 2, y: height / 2, label: operation, data: operation});
        restart();
    }

    function addVolumeNode() {
      var volumeList = prompt('Volumes:').split(',');
        var label;

        // Label node with volume (if all volumes are equal) or 'Volume' (otherwise)
        if (volumeList.length >= 1){
            label = volumeList[0];
            for (var i=0; i<volumeList.length; i++){
                if (volumeList[i] != label){ label = "Volume"; }
            }
        }
        if (label != "Volume"){label = label + " μL"; }

      nodes.push({
        id: ++lastNodeId,
        type: 'volume',
        x: width / 2,
        y: height / 2,
        label: label,
        data: volumeList
      });
      restart();
    }

    function save(){

        // note that we cannot serialise {nodes: nodes, links: links} because of cyclic references
        var node_list = [];
        for (i=0; i<nodes.length; i++){
            var node = nodes[i];
            var converted_node = {id: node.id, type: node.type, x: node.x, y: node.y, label: node.label, data:node.data};

            if (node.hasOwnProperty("parents")){
                converted_node.parentIds = [node.parents[0].id, node.parents[1].id];
            }
            node_list.push(converted_node);
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


   // Description form for well
    function updateDescriptionPanel(){

        var info = d3.select("#info");
        info.select("form").remove();

        if (!selected_node){
            return;
        }

        var form = info.append("form")
                .classed("form-horizontal", true)
                .classed("info-box", true)
                .attr("onsubmit", "return false;");

        // If top-level well list, give option to change name or number of wells
        if (selected_node.type == "well"){

            var div1 = form.append("div").classed("form-group", true);
            div1.append("label")
                .classed("control-label", true)
                 .classed("col-sm-2", true)
                .attr("for", "name")
                .text("Name:");

            div1.append("div")
                 .classed("col-sm-2", true)
                .append("input")
                .attr("type", "text")
                .attr("name", "name")
                .classed("form-control", true)
                .attr("value", selected_node.label)
                .on("change", function(){
                    selected_node.label = this.value;
                    restart(); // TODO: just redraw single label
                    console.log(nodes)
                });

            var div2 = form.append("div").classed("form-group", true);
            div2.append("label")
                .classed("control-label", true)
                .classed("col-sm-2", true)
                .attr("for", "num-wells")
                .text("Number of wells:");

            div2.append("div")
                 .classed("col-sm-2", true)

                .append("input")
                .attr("type", "text")
                .attr("id", "num-wells")
                .attr("name", "num-wells")
                .classed("form-control", true)
                .attr("value", selected_node.data.num_wells)
                .on("change", function(){
                    selected_node.data.num_wells = this.value;
                });



        } else if (selected_node.type == "volume"){
            var div1 = form.append("div").classed("form-group", true);
            div1.append("label")
                .classed("control-label", true)
                .classed("col-sm-2", true)
                .attr("for", "name")
                .text("Name:");

            div1.append("div")
                 .classed("col-sm-2", true)

                .append("input")
                .attr("type", "text")
                .attr("name", "name")
                .attr("value", selected_node.label)
                .on("change", function(){
                    selected_node.label = this.value;
                    restart(); // TODO: just redraw single label
                });


            var div2 = form.append("div");

            var volumeDivs = div2.selectAll("div")
                .data(selected_node.data)
                .enter()
                .append("div")
                .classed("form-group", true);

            var label = volumeDivs.append("label")
                .classed("control-label", true)
                 .classed("col-sm-2", true)
                .attr("for", "volume");

            label.append("i").classed("fa", true).classed("fa-minus", true)
                .on("click", function(d,i){
                    selected_node.data.splice(i, 1);
                    updateDescriptionPanel();
                });
            label.append("b").text(function(d, i){ return "Volume " + (i + 1) + ":"; });

            volumeDivs.append("input")
                .classed("control-input", true)
                 .classed("col-sm-2", true)
                .attr("name", "value")
                .attr("value", function(d){return d;})
                .on("change", function(){
                    var volumes = [];
                    var volumeInputs = volumeDivs.selectAll("input");
                    for (var i=0; i<volumeInputs.length; i++){
                        volumes.push(parseFloat(volumeInputs[i][0].value))
                    }
                    selected_node.data = volumes;
                });

            // adding an extra volume
            div2.append("div")
                .classed("form-group", true)
                .append("label")
                .classed("control-label", true)
                .classed("col-sm-2", true)
                .append("i").classed("fa", true).classed("fa-plus", true)
                .on("click", function(){
                    selected_node.data.push(0);
                    updateDescriptionPanel();
                });


        } else if (selected_node.type == "process"){
            var div1 = form.append("div").classed("form-group", true);
            div1.append("label")
                .classed("control-label", true)
                .classed("col-sm-2", true)
                .attr("for", "name")
                .text("Name:");

            div1.append("div")
                 .classed("col-sm-2", true)

                .append("input")
                .attr("type", "text")
                .attr("name", "name")
                .attr("value", selected_node.label)
                .on("change", function(){
                    selected_node.label = this.value;
                    restart(); // TODO: just redraw single label
                });

             var div2 = form.append("div").classed("form-group", true);
            div2.append("label")
                .classed("control-label", true)
                .classed("col-sm-2", true)
                .attr("for", "options")
                .text("Options:");

            div2.append("div")
                 .classed("col-sm-8", true)
                .append("textarea")
                .attr("cols", "80")
                .attr("rows", "20")
                .attr("name", "options")
                .text(selected_node.data)
                .on("change", function(){
                    selected_node.data = this.value;
                    restart(); // TODO: just redraw single label
                });

        }


        // If list of Volumes, give option to edit volumes
        // If an Aliquot, show contents
        // If a non-top level wellSet, list contents of each well
    }

  // app starts here
    svg.on('mousemove', mousemove)
        .on('mouseup', mouseup)
       .on('contextmenu', d3.contextMenu([{
                title: 'Add Well',
                action: addWellNode
            },{
                title: 'Add Volume',
                action: addVolumeNode
            },{
                title: 'Add Process',
                action: addProcessNode
            },{
				divider: true
			},{
                title: 'Clear',
                action: clearEverything
            },{
                title: 'Save',
                action: save
            }

       ])
    );

    restart();

    return {addWellNode: addWellNode, addVolumeNode: addVolumeNode, clearEverything: clearEverything, save: save};
}