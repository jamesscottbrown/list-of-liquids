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

    svg.on("dragover", function (d) {
        d3.event.preventDefault();
    })
        .on("drop", function (d) {
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
        selected_group = null,
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

    // update graph (called when needed)
    function restart() {
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
        }
        force.constraints(constraints);

        redrawGroups(); // draw groups before nodes so that they are in the background
        redrawLinks();
        redrawLinkLabels();

        // circle (node) group
        var circular_nodes = nodes.filter(function (d) {
            return process_node_types.indexOf(d.type) == -1
        });
        var process_nodes = nodes.filter(function (d) {
            return process_node_types.indexOf(d.type) != -1
        });

        redrawCircularNodes(circular_nodes);
        redrawRectangularNodes(process_nodes);


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

    function redrawLinks() {
        // path (link) group
        path = path.data(links);

        // add new links
        path.enter().append('svg:path')
            .attr('class', 'link')
            .attr("id", function(d,i){return "link-" + i;})
            .on('mousedown', function (d) {
                // select link
                mousedown_link = d;
                if (mousedown_link === selected_link) selected_link = null;
                else selected_link = mousedown_link;
                selected_node = null;
                updateDescriptionPanel(selected_node, selected_link, selected_group, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);
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
        path.on("contextmenu", d3.contextMenu(function (d) {
            return [{
                title: 'Change parent',
                action: function (elm, d) {
                    linkToChangeParent = d;
                }
            }]
        }))
    }

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

    function redrawCircularNodes(circular_nodes) {

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
        var g = circle.enter().append('svg:g').attr("id", "group-circle-node");

        g.append('svg:circle')
            .attr('class', 'node')
            .classed('resource', function (d) {
                return d.type == "resource"
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
            .on('mousedown', function (d) {

                if (linkToChangeParent){
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

                    updateDescriptionPanel(selected_node, selected_link, selected_group, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);

                    // reposition drag line
                    drag_line
                        .classed('hidden', false)
                        .attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + mousedown_node.x + ',' + mousedown_node.y);

                    restart();
                }

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

                // add link to graph (update if exists)
                addEdge();
                restart();
            })
            .on('contextmenu', d3.contextMenu([{
                    title: 'Process',
                    action: function (elm, d) {
                        var node = nodes.filter(function (n) {
                            return n.id == d.id
                        })[0];
                        addProcessNodeToNode(node, 'process');
                    }
                }, {
                    title: 'Pool',
                    action: function (elm, d) {
                        var node = nodes.filter(function (n) {
                            return n.id == d.id
                        })[0];
                        addProcessNodeToNode(node, 'pool');
                    }
                }, {
                    title: 'Select',
                    action: function (elm, d) {
                        var node = nodes.filter(function (n) {
                            return n.id == d.id
                        })[0];
                        addProcessNodeToNode(node, 'select');
                    }
                }, {
                    title: 'Take aliquot',
                    action: function (elm, d) {
                        var node = nodes.filter(function (n) {
                            return n.id == d.id
                        })[0];
                        takeAliquot(node);
                    }
                }, {
                    title: 'Delete',
                    action: function (elm, d) {
                        deleteNode(d);
                    }
                }])
            );

        // remove old nodes
        circle.exit().remove();

        // show node IDs
        g.append('svg:text')
            .attr('x', 0)
            .attr('y', 4)
            .attr('class', 'node-label')
            .attr("id", function(d){ return "label-" + d.id; });

        circleLabels = circle.selectAll('text');

        circleLabels.text(function (d) {
            if (parseInt(d.data.num_duplicates) > 1) {
                return d.label + " (×" + d.data.num_duplicates + ")";
            } else {
                return d.label;
            }
        });

    }

    function redrawGroups() {
        group = group.data(groups);

        group.enter().append("rect")
            .attr("rx", 8).attr("ry", 8)
            .attr("class", "group")
            .style("fill", function (d, i) {
                return color(i);
            })
            .on("click", function (d) {
                selected_node = false;
                selected_link = false;
                selected_group = d;

                updateDescriptionPanel(selected_node, selected_link, selected_group, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);

            });

        // remove old groups
        group.exit().remove();
    }

    function deleteNode(d) {

        if (selected_node == d){
            selected_node = false;
            updateDescriptionPanel(selected_node, selected_link, selected_group, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);
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

        // if node represents a resource, then adjust container contents to refer to the next node
        // corresponding to the same resource; if there is no such node, then do not delete the node
        // if it has, then it should not be deleted
        var allowDeletion = true;
        if (node.type == "resource") {

            var otherNodes = nodes.filter(function (d) {
                return (d.data.resource == node.data.resource) && (d.id != node.id);
            });

            if (otherNodes.length == 0) {
                allowDeletion = false;
            } else {
                for (var i = 0; i < containers.length; i++) {
                    for (var well in containers[i].contents) {
                        for (var j = 1; j < containers[i].contents[well].length; j++) {
                            containers[i].contents[well][j].node_id == otherNodes[0].id;
                        }
                    }
                }
            }
        }

        if (allowDeletion) {
            var index = nodes.indexOf(node);
            nodes.splice(index, 1);
        }

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


    function redrawRectangularNodes(process_nodes) {
        
        // Add new 'process' nodes
        // different shape; no ability to drag line from node; context menu

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

                    updateDescriptionPanel(selected_node, selected_link, selected_group, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);

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
                addEdge();
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

    function recolorLabels() {
        // update text color based on container
        circleLabels
            .style('fill', function (d) {
                var container_index = containers.map(function (x) {
                    return x.name;
                }).indexOf(d.data.container_name);

                return (container_index == -1) ? "#000" : color(container_index);
            });


        // Color nodes of type ''resource'' based on data in resource object with same name, not node object
        circleLabels.filter(function (d) {
            return d.type == "resource"
        })
            .style('fill', function (d) {

                var resource = resources.filter(function(r){return r.label == d.data.resource})[0];

                var container_index = containers.map(function (x) {
                    return x.name;
                }).indexOf(resource.data.container_name);

                return (container_index == -1) ? "#000" : color(container_index);
            });

        rectLabels.style('fill', function (d) {
            var container_index = containers.map(function (x) {
                return x.name;

            }).indexOf(d.data.container_name);

            return (container_index == -1) ? "#000" : color(container_index);
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
                    updateDescriptionPanel(selected_node, selected_link, selected_group, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);
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

    function addEdge() {

        var operator = "cross";

        var i = nodes.push({
            id: ++lastNodeId, type: operator, x: width * Math.random(), y: height / 2, label: "cross",
            parents: [mousedown_node, mouseup_node], data: {container_name: '', num_duplicates: 1}
        });
        i--;

        links.push({
            source: mousedown_node,
            target: nodes[i],
            data: getDefaultLinkData(true)
        });
        links.push({
            source: mouseup_node,
            target: nodes[i],
            data: getDefaultLinkData(false)
        });

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

    function clearEverything() {
        nodes = [];
        links = [];
        groups = [];

        containers = [];
        pipettes = [];

        lastNodeId = 0;
        d3.select("#info").select("form").remove();
        force.nodes(nodes).links(links).groups(groups);
        restart();
    }

    function addWellNode() {

        var label = prompt('Name:').trim();
        if (!label){ return; }

        nodes.push({
            id: ++lastNodeId, type: "resource", x: width * Math.random(), y: height / 2, label: label,
            data: {resource: label}
        });

        resources.push({
            id: ++lastResourceId, label: label, data: {num_wells: 1, container_name: '', volume: 1}
        });

        update_resource_list();
        selected_link = false;
        selected_group = false;
        selected_node = nodes[nodes.length - 1];
        updateDescriptionPanel(selected_node, selected_link, selected_group, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);

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
        updateDescriptionPanel(selected_node, selected_link, selected_group, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);

        restart();
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
            data: {operation: operation, selection: [], num_duplicates: 1, container_name: ""}, parents: [sourceNode]
        });
        i--;
        selected_node = nodes[i];
        restart();
        return i;
    }

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
    }

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

    function startRepeat() {
        selectingGroup = true;
        selectedNodes = [];

        d3.select("#repeatButton")
            .text("Done")
            .on("click", endRepeat);

        // Un-select all nodes
        selected_node = false;
        selected_link = false;
        recolorLabels();

    }

    function endRepeat() {
        selectingGroup = false;
        d3.select("#repeatButton")
            .on("click", startRepeat)
            .text("Select nodes for repeat");

        if (selectedNodes) {
            groups.push({"leaves": selectedNodes, data: {repeats: 2}})
        }

        force.nodes(nodes).links(links);
        force.groups(groups);
        restart();
        force.start();
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
        updateDescriptionPanel(selected_node, selected_link, selected_group, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);

        // clear line
        drag_line
            .classed('hidden', true)
            .style('marker-end', '');

        resetMouseVars();

        restart();
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

    restart();

    d3.select("#repeatButton")
        .on("click", startRepeat)
        .text("Select nodes for repeat");


    return {
        addWellNode: addWellNode, clearEverything: clearEverything, save: save,
        startRepeat: startRepeat, deleteNode: deleteNode, restart: restart
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