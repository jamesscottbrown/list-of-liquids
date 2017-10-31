// set up initial nodes and links
var nodes, lastNodeId, lastResourceId, links, groups, serialiseDiagram;
var color = d3.scale.category10();


function network_editor() {
    // set up SVG for D3
    var width = document.getElementById("network").offsetWidth,
        height = 900;

    var svg = d3.select('#network')
        .append('svg')
        .attr('id', 'network-svg')
        .attr('width', width)
        .attr('height', height);

    svg.on("dragover", function () {
        d3.event.preventDefault();
    })
        .on("drop", function () {
            var data = d3.event.dataTransfer.getData("custom-data");

            nodes.push({
                id: ++lastNodeId, type: "resource", x: width * Math.random(), y: height / 2, label: data,
                data: {resource: data}
            });
            restart();
        });

    var process_node_types = ['zip', 'cross', 'prod', 'process'];
    var operationLabels = {'zip': 'zip', cross: "cross"};

    var selectingGroup = false;
    var selectedNodes = [];

    var rectLabels, circleLabels;

    var linkToChangeParent = false;

    if (protocol_string) {

        console.log(protocol_string);
        var obj = JSON.parse(protocol_string);

        nodes = obj.nodes;

        var nodePosition = [];
        for (var i = 0; i < nodes.length; i++) {
            nodePosition[nodes[i].id] = i;
        }

        for (i = 0; i < nodes.length; i++) {
            if (nodes[i].hasOwnProperty('parentIds')) {
                nodes[i].parents = nodes[i].parentIds.map(function (x) {
                    return nodes[nodePosition[x]]
                });
            }

            var nodeType = nodes[i].type;
            if (['zip', 'cross'].indexOf(nodeType) != -1) {
                nodes[i].label = operationLabels[nodeType];
            }
        }

        links = [];
        for (i = 0; i < obj.links.length; i++) {
            var link = obj.links[i];
            links.push({
                source: nodes[nodePosition[link.source_id]],
                target: nodes[nodePosition[link.target_id]],
                data: link.data
            });
        }

        groups = obj.groups;
        containers = obj.containers;
        pipettes = obj.pipettes;
        resources = obj.resources;

    } else {
        nodes = [];
        links = [];
        groups = [];

        containers = [];
        pipettes = [];
        resources = [];
    }

    lastNodeId = 0;
    for (var i=0; i<nodes.length; i++){
        if (nodes[i].id > lastNodeId) {
            lastNodeId = nodes[i].id;
        }
    }

    lastResourceId = 0;
    for (var i=0; i<resources.length; i++){
        if (resources[i].id > lastResourceId) {
            lastResourceId = resources[i].id;
        }
    }


    var force = cola.d3adaptor()
        .linkDistance(50)
        .size([width, height])
        .nodes(nodes)
        .links(links)
        .groups(groups)
        .avoidOverlaps(true)
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

    svg.append('svg:defs').append('svg:marker')
        .attr('id', 'end-arrow-open')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 6)
        .attr('markerWidth', 3)
        .attr('markerHeight', 3)
        .attr('orient', 'auto')
        .append('svg:path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#FFF')
        .style('stroke', 'black')
        .style('stroke-width', '2px');

    // line displayed when dragging new nodes
    var drag_line = svg.append('svg:path')
        .attr('class', 'link dragline hidden')
        .attr('d', 'M0,0L0,0');

    // handles to link and node element groups
    var group_group = svg.append('svg:g');
    var group = group_group.selectAll(".group");

    var path_group = svg.append('svg:g');
    var path = path_group.selectAll('path');

    var circle_group = svg.append('svg:g');
    var circle = circle_group.selectAll('g');

    var rect_group = svg.append('svg:g');
    var rect = rect_group.selectAll('g');

    var path_labels_group = svg.append('svg:g');
    var path_labels = path_labels_group.selectAll('g');

    // mouse event vars
    var selected_node = null,
        selected_link = null,
        mousedown_link = null,
        mousedown_node = null,
        mouseup_node = null;

    // update force layout (called automatically each iteration)
    function tick() {

        if (mousedown_node){ return; }

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

        path_labels.attr("y", function (d) {
                // bottom of text box is half-way between nodes vertically
                return (d.source.y + d.target.y) / 2;
            })
            .attr("x", function (d) {
                // find position of top edge of bounding box of text
                var yTop = (d.source.y + d.target.y) / 2 - this.getBBox().height;

                // find x-coordinate of position along edge with this y-coordinate
                var xTopCorner = d.source.x + (yTop - d.source.y) * (d.target.x - d.source.x) / (d.target.y - d.source.y);

                // similarly for the bottom corner
                var yBottom = yTop + this.getBBox().height;
                var xBottomCorner = d.source.x + (yBottom - d.source.y) * (d.target.x - d.source.x) / (d.target.y - d.source.y);


                if (d.source.x > d.target.x) {
                    // arrow directed left:

                    // if parent has another child, position text so bottom-right corner of bounding box touches edge
                    var linksToThisNode = links.filter(function(l){return l.source.id == d.source.id});
                    if (linksToThisNode.length > 1){
                        return xBottomCorner - this.getBBox().width;
                    }

                    // otherwise, position text so upper-left corner of bounding box touches edge
                    return xTopCorner;
                } else {
                    // arrow directed right: position text so upper-right corner of bounding box touches edge
                    return xTopCorner - this.getBBox().width;
                }
            });

        circle.attr('transform', function (d) {
            return 'translate(' + d.x + ',' + d.y + ')';
        });

        rect.attr('transform', function (d) {
            return 'translate(' + (d.x - 12) + ',' + (d.y - 12) + ')';
        });


        svg.selectAll(".group")
            .attr("x", function (d) {
                return getBounds(d).x;
            })
            .attr("y", function (d) {
                return getBounds(d).y;
            })
            .attr("width", function (d) {
                return getBounds(d).width;
            })
            .attr("height", function (d) {
                return getBounds(d).height;
            });
    }


    // update graph (called when needed)
    function restart() {
        force.groups(groups);

        // create an array mapping from node id to index in the nodes array
        var nodePosition = [];
        for (var i = 0; i < nodes.length; i++) {
            nodePosition[nodes[i].id] = i;
        }

        var constraints = [];
        for (i = 0; i < links.length; i++) {
            var link = links[i];

            // try to direct all edges downwards
            constraints.push({
                "axis": "y", "left": nodePosition[link.source.id],
                "right": nodePosition[link.target.id], "gap": 50
            });

            // try to direct the solid edges right
            if (link.data.addToThis || link.data.addFirst) {
                constraints.push({
                    "axis": "x", "left": nodePosition[link.source.id],
                    "right": nodePosition[link.target.id], "gap": 50
                });
            }

            // try to direct the dashed edges left - but only if there is a solid arrow too
            var otherLinks = links.filter(function (d) {
                return d.target.id == link.target.id && d.source.id != link.source.id
                                       && (d.data.addFirst || d.data.addToThis);
            });

            if (otherLinks.length > 0) {
                constraints.push({
                    "axis": "x", "left": nodePosition[link.target.id],
                    "right": nodePosition[link.source.id], "gap": 50
                });
            }

            // arrange process nodes within group
            for (var j = 0; j < groups.length; j++) {

                var offsets = groups[j].leaves.map(function (d) {

                    if (typeof d == "object"){
                       d = nodePosition[d.id];
                    }
                    return {"node": d, "offset": "0"}
                });

                // arrange in horizontal line
                if (offsets.length > 1) {
                    constraints.push({
                        "type": "alignment",
                        "axis": "y",
                        "offsets": offsets
                    })

                }

                // impose minimum horizontal separation (TODO: why is avoidOverlap not sufficient?)
                for (var k=0; k<groups[j].leaves.length - 1; k++){

                    var node0 = groups[j].leaves[k];
                    if (typeof node0 == "object"){
                       node0 = nodePosition[node0.id];
                    }

                    var node1 = groups[j].leaves[k+1];
                    if (typeof node1 == "object"){
                       node1 = nodePosition[node1.id];
                    }

                    constraints.push({"axis": "x", "left": node0, "right": node1, "gap": 150 });
                }
            }


        // Add fixed nodes on the upper-left and bottom right corner, with constraints to keep nodes within the SVG
        var topLeft = { x: 0, y: height-100, fixed: true },
        tlIndex = nodes.length,
        bottomRight = { x: (width-100), y: 0, fixed: true },
        brIndex = nodes.length + 1;

        var gap=24;
        for (var i=0; i<nodes.length; i++){
            constraints.push({ axis: 'x', type: 'separation', left: tlIndex, right: i, gap: gap });
            constraints.push({ axis: 'y', type: 'separation', left: tlIndex, right: i, gap: gap });
            constraints.push({ axis: 'x', type: 'separation', left: i, right: brIndex, gap: gap });
            constraints.push({ axis: 'y', type: 'separation', left: i, right: brIndex, gap: gap });
        }


        force.nodes(nodes.concat([topLeft, bottomRight]));


        force.constraints(constraints);

        redrawGroups(); // draw groups before nodes so that they are in the background
        redrawLinks();
        redrawLinkLabels();

        redrawNodes(nodes);


        // update node boundary boxes
        for (var i=0; i<nodes.length; i++){
            var bb = document.getElementById("label-" + nodes[i].id).getBBox();
            nodes[i].width = bb.width;
            nodes[i].height = bb.height;
        }

        force.start(10, 15, 20);

        update_container_list();
        update_pipette_list();
        update_resource_list();

        recolorLabels();
    }

        function redrawNodes(process_nodes) {

        // Add new 'process' nodes
        rect = rect.data(process_nodes, function (d) {
            return d.id;
        });

        // add new nodes
        var g2 = rect.enter().append('svg:g');

        g2.append('svg:rect')
            .attr('class', 'node')
            .classed('resource', function (d) {
                return d.type == "resource"
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
            .on('mousedown', function (d) {

                if (linkToChangeParent) {
                    changeParent(d);
                    return;
                }

                // ignore right click
                if (("which" in d3.event && d3.event.which == 3) // Firefox, WebKit
                    || ("button" in d3.event && d3.event.button == 2))  // IE
                    return;

                if (selectingGroup) {

                    var pos = selectedNodes.indexOf(d.id);
                    if (pos == -1) {
                        selectedNodes.push(d.id);
                    } else {
                        selectedNodes.splice(pos, 1);
                    }
                    recolorLabels();

                } else {

                    // select node
                    mousedown_node = d;
                    if (mousedown_node === selected_node) selected_node = null;
                    else selected_node = mousedown_node;
                    selected_link = null;

                    updateDescriptionPanel(selected_node, selected_link, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);

                    // reposition drag line
                    drag_line
                        .classed('hidden', false)
                        .attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + mousedown_node.x + ',' + mousedown_node.y);

                    restart();
                }
            })
            .on('mouseup', function (d) {
                // nb. no mousedown event registered, so no need to check for drag-to-self
                if (!mousedown_node) {
                    return;
                }

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

                // add link to graph (update if exists)
                addEdge(shiftDown);
                restart();
            })

            .on('contextmenu', d3.contextMenu(createOptionsMenu));

        // show node IDs
        g2.append('svg:text')
            .attr('x', 12)
            .attr('y', 4 + 12)
            .attr("id", function(d){ return "label-" + d.id; })
            .attr('class', 'node-label');

        rectLabels = rect.selectAll('text');

        rectLabels.text(function (d) {
                if (parseInt(d.data.num_duplicates) > 1 ){
                 return d.label + " (×" + d.data.num_duplicates + ")";
                } else {
                  return d.label;
                }
            });

        // remove old nodes
        rect.exit().remove();
    }


    function redrawLinks() {
        // path (link) group
        path = path.data(links);

        // add new links
        path.enter().append('svg:path')
            .attr('class', 'link')
            .attr("id", function(d,i){return "link-" + i;})
            .on('mousedown', function (d) {

                if (selectingGroup){return;}

                // select link
                mousedown_link = d;
                if (mousedown_link === selected_link) selected_link = null;
                else selected_link = mousedown_link;
                selected_node = null;
                updateDescriptionPanel(selected_node, selected_link, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);
                restart();
            });

        // style  links
        path.classed('selected', function (d) {
                return d === selected_link;
            })
            .style('marker-start', '')
            .style('marker-end', function (d) {
                return (d.data.addFirst || d.data.addToThis) ? 'url(#end-arrow)' : 'url(#end-arrow-open)'
            });

        // remove old links
        path.exit().remove();

        path_group.selectAll('.link')
            .classed('addToThis', function (d) {
                return d.data.addToThis;
            });


        // Color all links according to pipette used
        path_group.selectAll('.link').style('stroke', function (d) {
            var pipette_index = pipettes.map(function (x) {
                return x.name;
            }).indexOf(d.data.pipette_name);

            return (pipette_index == -1) ? "#000" : color(pipette_index);
        });

        // Color selected link red
        if (selected_link) {
            path_group.selectAll('.link').filter(function (d) {
                return d == selected_link
            }).style('stroke', 'red');
        }

        // context-menu
        path.on("contextmenu", d3.contextMenu(function () {
            return [{
                title: 'Change parent',
                action: function (elm, d) {
                    linkToChangeParent = d;
                }
            }]
        }))
    }

    function redrawLinkLabels() {
        // volume labels
        path_labels = path_labels.data(links);

        path_labels.enter().append('text');

        path_labels_group
            .selectAll('text')
            .text(function (d) {
                return (d.data.volumes.length == 1) ? d.data.volumes[0] + " μL" : "";
            })
            .style("visibility", function (d) {
                return d.data.addToThis ? 'hidden' : 'visible'
            });

        path_labels.exit().remove();

    }

    function recolorLabels() {

        // update text color based on container
        rectLabels.style('fill', function (d) {
            var container_index = containers.map(function (x) {
                return x.name;

            }).indexOf(d.data.container_name);

            return (container_index == -1) ? "#000" : color(container_index);
        });

        // Color nodes of type ''resource'' based on data in resource object with same name, not node object
        rectLabels.filter(function (d) {
            return d.type == "resource"
        })
            .style('fill', function (d) {

                var resource = resources.filter(function(r){return r.label == d.data.resource})[0];
                if (resource) {
                    // resource may be undefined if we are mid-way through deleting the nodes corresponding to a resource
                    var container_index = containers.map(function (x) {
                        return x.name;
                    }).indexOf(resource.data.container_name);

                    return (container_index == -1) ? "#000" : color(container_index);
                }
            });

        // color single selected node red
        if (selected_node) {
            d3.selectAll('text').filter(function (d) {
                return d == selected_node
            }).style('fill', 'red');
        }

        //color set of selected nodes red
        if (selectingGroup && selectedNodes) {
            d3.selectAll('text').filter(function (d) {
                return selectedNodes.indexOf(d.id) != -1
            }).style('fill', 'red');
        }

        d3.select("#resources").selectAll("li").style("color", function (d) {
            var container_index = containers.map(function (x) {
                return x.name;
            }).indexOf(d.data.container_name);

            return (container_index == -1) ? "#000" : color(container_index);
        });

    }

    function redrawGroups() {
        group = group.data(groups);

        group.enter().append("rect")
            .attr("rx", 8).attr("ry", 8)
            .attr("class", "group")
            .style("fill", "none")
            .style("stroke", function (d, i) {
                return color(i);
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

                    if (mousedown_node.type == "process"){

                        var mousedown_node_index = nodes.indexOf(mousedown_node);

                        // remove node from any other groups
                        for (var i=0; i<groups.length; i++){
                            groups[i].leaves = groups[i].leaves.filter( function(d){ return d.id != mousedown_node.id } );
                        }

                        // remove any now empty groups
                        groups = groups.filter(function(d){ return (d.leaves.length > 0);} );

                        // add node to this group
                        groups[groups.indexOf(d)].leaves.push(mousedown_node_index);
                        force.nodes(nodes).links(links).groups(groups);
                        restart();
                    }


                });

        // remove old groups
        group.exit().remove();
    }

    /* Helper functions */
    function getBounds(group) {
        // For some reason, Cola doe snot automatically calculate .bounds for each group,
        // just each individual leaf of the group

        var bounds = {x: Infinity, X: 0, y: Infinity, Y: 0};

        for (var i = 0; i < group.leaves.length; i++) {
            bounds.x = Math.min(bounds.x, group.leaves[i].bounds.x);
            bounds.y = Math.min(bounds.y, group.leaves[i].bounds.y);

            bounds.X = Math.max(bounds.X, group.leaves[i].bounds.X);
            bounds.Y = Math.max(bounds.Y, group.leaves[i].bounds.Y);
        }

        var padding = 10;
        bounds.x -= padding;
        bounds.X += padding;
        bounds.y -= padding;
        bounds.Y += padding;

        bounds.width = bounds.X - bounds.x;
        bounds.height = bounds.Y - bounds.y;

        return bounds;
    }

    function getDefaultLinkData(addToThis) {
        var default_link_data = {
            volumes: [1],
            addToThis: true,
            addFirst: false,
            changeTips: false,
            changeTips: "between-sources",
            distribute: false,
            disposeTips: "trash",
            blowout: false,
            touchTip: false,
            airgap: 0,
            mixBefore: {repeats: 0, volume: 0},
            mixAfter: {repeats: 0, volume: 0},
            pipette_name: ''
        };

        default_link_data.addToThis = addToThis;
        return default_link_data;
    }

    function getNodeContainer(node){
       var container;
        if (node.type == "resource"){
            var resource = resources.filter(function(r){return r.label == node.data.resource})[0];
            container = resource.data.container_name;
        } else {
            container = node.data.container_name;
        }
        return container;
    }


    function createOptionsMenu(d) {
        var menu = [];

        var operations = ['zip', 'cross'];
        if (d.type != "process") {

            function changeOperation(operation) {
                return function (elm, d) {
                    nodes.filter(function (n) {
                        return n.id == d.id
                    })[0].type = operation;
                    nodes.filter(function (n) {
                        return n.id == d.id
                    })[0].label = operationLabels[operation];
                    restart();
                    updateDescriptionPanel(selected_node, selected_link, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);
                }
            }

            for (var i = 0; i < operations.length; i++) {
                var operation = operations[i];

                menu.push({
                    title: operation,
                    disabled: (operation == d.type),
                    action: changeOperation(operation)
                })
            }

            menu.push({
                divider: true
            });
        }

        menu.push({
            title: 'Process',
            action: function (elm, d) {
                var node = nodes.filter(function (n) {
                    return n.id == d.id
                })[0];
                addProcessNodeToNode(node, 'process');
            }
        });
        menu.push({
            title: 'Pool',
            action: function (elm, d) {
                var node = nodes.filter(function (n) {
                    return n.id == d.id
                })[0];
                addProcessNodeToNode(node, 'pool');
            }
        });
        menu.push({
            title: 'Select',
            action: function (elm, d) {
                var node = nodes.filter(function (n) {
                    return n.id == d.id
                })[0];
                addProcessNodeToNode(node, 'select');
            }
        });
        menu.push({
            title: 'Take aliquot',
            action: function (elm, d) {
                var node = nodes.filter(function (n) {
                    return n.id == d.id
                })[0];
                takeAliquot(node);
            }
        });


        menu.push({
            divider: true
        });

        menu.push({
            title: 'Delete',
            action: function (elm, d) {
                deleteNode(d);
            }
        });
        return menu;
    }

    /* Handling the mouse */
    function resetMouseVars() {
        mousedown_node = null;
        mouseup_node = null;
        mousedown_link = null;
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

    /* Copying */
    function startCopy() {
        selectingGroup = true;
        selectedNodes = [];

        d3.select("#repeatCopy")
            .text("Copy")
            .on("click", endCopy);

        d3.select("#cancelCopyButton").style("visibility", "visible");

        // Un-select all nodes
        selected_node = false;
        selected_link = false;
        recolorLabels();

    }

    function endCopy() {
        selectingGroup = false;
        d3.select("#repeatCopy")
            .on("click", startCopy)
            .text("Select nodes for repeat");

        d3.select("#cancelCopyButton").style("visibility", "hidden");

        // copy selected nodes
        var newNode = [];
        for (var i = 0; i < selectedNodes.length; i++) {
            var oldNode = nodes.filter(function (n){ return n.id == selectedNodes[i]})[0];

            var index = nodes.push({
                id: ++lastNodeId,
                type: oldNode.type,
                label: oldNode.label,
                data: JSON.parse(JSON.stringify(oldNode.data)) // create new object, rather than reference to data of copied node
            });

            newNode[oldNode.id] = nodes[index-1];

            // TODO: copy group membership
            for (var j=0; j<groups.length; j++){
                if (groups[j].leaves.indexOf(oldNode) != -1){
                   groups[j].leaves.push(newNode[oldNode.id]);
                }
            }
        }


        // copy links to a selected node
        for (var i = 0; i < links.length; i++){
            var link = links[i];

            // skip link if target is not selected node
            if (selectedNodes.indexOf(link.target.id) == -1){
                continue;
            }

            var sourceNode = link.source;
            if (selectedNodes.indexOf(link.source.id) != -1){
                sourceNode = newNode[link.source.id];
            }

            links.push({
                source: sourceNode,
                target: newNode[link.target.id],
                data: JSON.parse(JSON.stringify(link.data)) // create new object, rather than reference to data of copied link
            })
        }

        force.nodes(nodes).links(links);
        restart();
        force.start();
    }

    function cancelCopy(){
        selectingGroup = false;
        d3.select("#repeatCopy")
            .on("click", startCopy)
            .text("Select nodes to copy");

        d3.select("#cancelCopyButton").style("visibility", "hidden");

        // Un-select all nodes
        selected_node = false;
        selected_link = false;
        recolorLabels();
    }


    /* Functions that edit the graph structure */
    function changeParent(newParent){

        // update link
        linkToChangeParent.source = newParent;

        // update list of parent stored in child node
        if (linkToChangeParent.target.parents[0] == linkToChangeParent.source){
            linkToChangeParent.target.parents[0] = newParent;
        } else {
           linkToChangeParent.target.parents[1] = newParent;
        }

        // redraw
        linkToChangeParent = false;
        restart();
    }

    function deleteNode(d) {

        if (selected_node == d){
            selected_node = false;
            updateDescriptionPanel(selected_node, selected_link, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);
        }

        // delete arrows to this node
        if (process_node_types.indexOf(d.type) != "resource") {
            var inLinks = links.filter(function (l) {
                return l.target.id == d.id;
            });
            for (var i = 0; i < inLinks.length; i++) {
                links.splice(links.indexOf(inLinks[i]), 1);
            }
        }
        deleteDownFromNode(d);

        // clear line
        drag_line
            .classed('hidden', true)
            .style('marker-end', '');
        resetMouseVars();

        // update index field for each node
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].index = i;
        }

        force.nodes(nodes).links(links).groups(groups);
        restart();
    }


    function deleteDownFromNode(d) {

        // Do not call this function directly: always call deleteNode() instead
        var i;
        var node = nodes.filter(function (n) {
            return n.id == d.id
        })[0];

        // delete results of this operation from contents of container
        var containerName = node.data.container_name;
        if (containerName) {
            var container = containers.filter(function (d) {
                return d.name == containerName;
            })[0];

            for (var well in container.contents) {

                var aliquots_to_remove = container.contents[well].filter(function (d) {
                    return d.node_id == node.id
                });

                for (var j = 0; j < aliquots_to_remove.length; j++) {
                    container.contents[well].splice(container.contents[well].indexOf(aliquots_to_remove[j]), 1);
                }
            }
        }

        // if node represents a resource that still exists then adjust container contents to refer to the next node
        // corresponding to the same resource; if there is no such node, then do not delete the node
        // if it has, then it should not be deleted
        var allowDeletion = true;
        var resourceStillExists = resources.filter(function(r){return r.label == node.data.resource}).length > 0;
        if (node.type == "resource" && resourceStillExists) {

            var otherNodes = nodes.filter(function (d) {
                return (d.data.resource == node.data.resource) && (d.id != node.id);
            });

            if (otherNodes.length == 0) {
                allowDeletion = false;
            } else {
                for (var i = 0; i < containers.length; i++) {
                    for (var well in containers[i].contents) {
                        for (var j = 1; j < containers[i].contents[well].length; j++) {
                            containers[i].contents[well][j].node_id = otherNodes[0].id;
                        }
                    }
                }
            }
        }

        if (allowDeletion) {
            var index = nodes.indexOf(node);
            nodes.splice(index, 1);
        }

        // remove from groups
        for (var i=0; i < groups.length; i++){
            groups[i].leaves = groups[i].leaves.filter(function(d){ return d != node; })
        }
        // remove any now-empty groups
        groups = groups.filter(function(d){ return (d.leaves.length > 0);} );

        // delete incoming links
        var inLinks = links.filter(function (l) {
            return l.target.id == d.id;
        });
        for (i = 0; i < inLinks.length; i++) {
            links.splice(links.indexOf(inLinks[i]), 1);
        }

        // delete outgoing links
        var children = [];

        var outLinks = links.filter(function (l) {
            return l.source.id == d.id;
        });
        for (i = 0; i < outLinks.length; i++) {
            children.push(outLinks[i].target);
            links.splice(links.indexOf(outLinks[i]), 1);
        }

        // delete the nodes that outgoing links target
        for (i = 0; i < children.length; i++) {
            if (nodes.indexOf(children[i] != -1)) {
                deleteDownFromNode(children[i]);
            }
        }
    }


    function addEdge(addToThis) {

        var container;
        if (addToThis){
            container = getNodeContainer(mousedown_node);
        } else {
            container = '';
        }
        var operator = "cross";

        var i = nodes.push({
            id: ++lastNodeId, type: operator, x: width * Math.random(), y: height / 2, label: "cross",
            parents: [mousedown_node, mouseup_node],
            data: {container_name: container, num_duplicates: 1}
        });
        i--;

        links.push({
            source: mousedown_node,
            target: nodes[i],
            data: getDefaultLinkData(false)
        });
        links.push({
            source: mouseup_node,
            target: nodes[i],
            data: getDefaultLinkData(addToThis)
        });

        selected_link = null;
        selected_node = nodes[i];
    }


    function clearEverything() {
        nodes = [];
        links = [];
        groups = [];

        containers = [];
        pipettes = [];
        resources = [];

        lastNodeId = 0;
        d3.select("#info").select("form").remove();
        force.nodes(nodes).links(links).groups(groups);
        restart();
    }

    function clearDiagram(){
        nodes = [];
        links = [];
        groups = [];

        for (var i=0; i<containers.length; i++){
            containers[i].contents = [];
        }

        lastNodeId = 0;
        d3.select("#info").select("form").remove();
        force.nodes(nodes).links(links).groups(groups);
        restart();
    }

    function addWellNode() {

        var label = prompt('Name:').trim();

        // check name is empty and unique
        var resourceNames = resources.map(function(r){ return r.label});
        if (!label || resourceNames.indexOf(label) != -1 ){
            return;
        }

        nodes.push({
            id: ++lastNodeId, type: "resource", x: width * Math.random(), y: height / 2, label: label,
            data: {resource: label}
        });

        resources.push({
            id: ++lastResourceId, label: label, data: {num_wells: 1, container_name: '', volume: 1}
        });

        update_resource_list();
        selected_link = false;
        selected_node = nodes[nodes.length - 1];
        updateDescriptionPanel(selected_node, selected_link, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);

        restart();
    }

    function addProcessNodeToNode(sourceNode, kind) {
        i = addProcessNode(sourceNode, kind);

        nodes[i].data.container_name = sourceNode.data.container_name;

        var data = getDefaultLinkData(true);
        data.command = "";

        if (kind == "pool"){
            data.addToThis = false;
        }

        links.push({
            source: sourceNode, target: nodes[i],
            data: data
        });

        selected_node = nodes[nodes.length - 1];

        // add group
        groups.push({leaves: [nodes.length - 1], data: {}});
        force.nodes(nodes).links(links).groups(groups);

        restart();

       updateDescriptionPanel(selected_node, selected_link, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);
    }

    function addProcessNode(sourceNode, kind) {

        var operation, type;
        if (kind) {
            operation = kind;
            type = kind;

        } else {
            operation = prompt('Operation:');
            type = 'process';
        }

        var i = nodes.push({
            id: ++lastNodeId, type: type, x: width * Math.random(), y: height / 2, label: operation,
            data: {operation: operation, options: {}, selection: [], num_duplicates: 1, container_name: "", process_type: "wait"},
            parents: [sourceNode]
        });
        i--;
        selected_node = nodes[i];
        restart();
        return i;
    }

    function takeAliquot(node) {
        var i = nodes.push({
            id: ++lastNodeId, type: "aliquot", x: width * Math.random(), y: height / 2, label: "aliquot",
            parents: [node], data: {container_name: '', num_duplicates: 1}
        });
        i--;

        links.push({
            source: node,
            target: nodes[i],
            data: getDefaultLinkData(false)
        });

        selected_link = null;
        selected_node = nodes[i];
        updateDescriptionPanel(selected_node, selected_link, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);

        // clear line
        drag_line
            .classed('hidden', true)
            .style('marker-end', '');

        resetMouseVars();

        restart();
    }

    /* Serialising and saving */
    serialiseDiagram = function () {
        // note that we cannot serialise {nodes: nodes, links: links} because of cyclic references
        var node_list = [];
        for (i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            var converted_node = {
                id: node.id,
                type: node.type,
                x: node.x,
                y: node.y,
                label: node.label,
                data: node.data
            };

            if (node.hasOwnProperty("parents")) {
                converted_node.parentIds = node.parents.map(function (x) {
                    return x.id
                });
            }
            node_list.push(converted_node);
        }

        var link_list = [];
        for (i = 0; i < links.length; i++) {
            var link = links[i];
            link_list.push({source_id: link.source.id, target_id: link.target.id, data: link.data});
        }

        var group_list = [];
        for (i = 0; i < groups.length; i++) {

            var leaves = [];

            for (var j = 0; j < groups[i].leaves.length; j++) {
                leaves.push({
                    data: groups[i].leaves[j].data,
                    id: groups[i].leaves[j].id,
                    bounds: groups[i].leaves[j].bounds
                })
            }

            group_list.push({leaves: leaves});
        }


        return JSON.stringify({
            nodes: node_list, links: link_list, groups: group_list,
            containers: containers, pipettes: pipettes, resources: resources
        });
    };

    function save() {
        var protocol_string = serialiseDiagram();
        $.ajax({
            type: "POST",
            contentType: "application/json; charset=utf-8",
            url: window.location.href + "save",
            dataType: 'html',
            async: true,
            data: protocol_string,
            beforeSend: function (xhr) {
                xhr.setRequestHeader("X-CSRFToken", csrf_token);
            },
            success: function () {
                console.log("SUCCESS")
            },
            error: function (result, textStatus) {
                console.log(result);
                console.log(textStatus);
            }
        })
    }

    
    // app starts here
    svg.on('mousemove', mousemove)
        .on('mouseup', mouseup)
        .on('contextmenu',
            d3.contextMenu([{
                title: 'Add Well',
                action: addWellNode
            }, {
                divider: true
            }, {
                title: 'Clear',
                action: clearEverything
            }, {
                title: 'Save',
                action: save
            }
            ])
        );

    var shiftDown = false;
    d3.select("body")
        .on("keydown", function () {
            if (d3.event.key == "Shift") {
                shiftDown = true;
                console.log("ON")
            }
        })
        .on("keyup", function () {
            if (d3.event.key == "Shift") {
                shiftDown = false;
                console.log("OFF")
            }
        });

    restart();

    d3.select("#repeatCopy")
        .on("click", startCopy)
        .text("Select nodes to copy");
    d3.select("#cancelCopyButton")
        .on("click", cancelCopy)
        .text("Cancel copy");


    return {
        addWellNode: addWellNode, clearEverything: clearEverything, save: save,
        startCopy: startCopy, deleteNode: deleteNode, restart: restart,
        getNodeContainer: getNodeContainer, clearDiagram: clearDiagram
    };
}

function downloadDiagram() {
    var serializer = new XMLSerializer();
    var xmlString = serializer.serializeToString(d3.select('#network-svg').node());

    // Construct an XML string containing CSS rules in network_editor.css
    var css = "<defs> <style type='text/css'><![CDATA[";
    for (var i = 0; i < document.styleSheets.length; i++) {
        var styleSheet = document.styleSheets[i];

        if (styleSheet.ownerNode.href.indexOf("network_editor.css") != -1) {
            for (var j = 0; j < styleSheet.cssRules.length; j++) {
                css = css + styleSheet.cssRules[j].cssText + "\n";
            }
        }
    }
    css = css + "]]></style></defs>";

    // Insert this after the first '>' (i.e. after the initial '<svg ...>')
    var pos = xmlString.indexOf('>');
    var img_css = xmlString.slice(0, pos+1) + css + xmlString.slice(pos+1);

    var imgData = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(img_css)));
    d3.select("#svg-download-link").attr("href", imgData);
}