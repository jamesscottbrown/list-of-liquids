// set up initial nodes and links
var nodes, lastNodeId, links, groups, serialiseDiagram;
var color = d3.scale.category10();


function network_editor() {
    // set up SVG for D3
    var width = document.getElementById("network").offsetWidth,
        height = 900;

    var svg = d3.select('#network')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    svg.on("dragover", function (d) {
        d3.event.preventDefault();
    })
        .on("drop", function (d) {
            var data = d3.event.dataTransfer.getData("custom-data");

            nodes.push({
                id: ++lastNodeId, type: "well", x: width * Math.random(), y: height / 2, label: data,
                data: {resource: data}
            });
            restart();
        });

    var process_node_types = ['zip', 'cross', 'prod', 'process'];
    var operationLabels = {'zip': 'zip', cross: "cross"};

    var selectingGroup = false;
    var selectedNodes = [];

    var rectLabels, circleLabels;

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
    lastNodeId = nodes.length - 1;

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

        path_labels.attr("x", function (d) {
            return 8 + (d.source.x + d.target.x) / 2;
        })
            .attr("y", function (d) {
                return (d.source.y + d.target.y) / 2;
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
            constraints.push({
                "axis": "y", "left": nodePosition[link.source.id],
                "right": nodePosition[link.target.id], "gap": 50
            })
        }
        force.constraints(constraints);

        redrawGroups(); // draw groups ebfore nodes so that they are in the background
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

        force.start();

        update_container_list();
        update_pipette_list();
        update_resource_list();

        recolorLabels();

    }

    function redrawLinks() {
        // path (link) group
        path = path.data(links);

        // update existing links
        path.classed('selected', function (d) {
            return d === selected_link;
        })
            .style('marker-start', '')
            .style('marker-end', function (d) {
                return (d.data.addFirst || d.data.addToThis) ? 'url(#end-arrow)' : 'url(#end-arrow-open)'
            });

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
                updateDescriptionPanel(selected_node, selected_link, selected_group, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram);
                restart();
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
            .attr("id", function(d){ return "label-" + d.id; })
            .text(function (d) {
                return d.label;
            });

        circleLabels = circle.selectAll('text');

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

        if (process_node_types.indexOf(d.type) == "well") {
            deleteDownFromNode(d);
        } else {
            // delete arrows to this process node
            var inLinks = links.filter(function (l) {
                return l.target.id == d.id;
            });
            for (var i = 0; i < inLinks.length; i++) {
                links.splice(links.indexOf(inLinks[i]), 1);
            }

            deleteDownFromNode(d);
        }

        // clear line
        drag_line
            .classed('hidden', true)
            .style('marker-end', '');
        resetMouseVars();

        restart();
    }


    function deleteDownFromNode(d) {

        var i;

        // delete this node
        var index = nodes.indexOf(nodes.filter(function (n) {
            return n.id == d.id
        })[0]);
        nodes.splice(index, 1);

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

        // update existing node labels
        rect.selectAll("text")
            .text(function (d) {
                return d.label;
            });

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
            .attr('y', 4 + 12)
            .attr("id", function(d){ return "label-" + d.id; })
            .attr('class', 'id')
            .text(function (d) {
                return d.label;
            });

        rectLabels = rect.selectAll('text');

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


        circleLabels.filter(function (d) {
            return d.type == "well"
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

        // handle arrow draw from well/aliquot to process (e.g. thermocycle)
        if (mouseup_node.type == "process" && (mousedown_node.type != "volume")) {
            links.push({
                source: mousedown_node,
                target: mouseup_node,
                data: getDefaultLinkData(true)
            });
            selected_node = mouseup_node;
            return;
        }

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

        var label = prompt('Name:');

        nodes.push({
            id: ++lastNodeId, type: "well", x: width * Math.random(), y: height / 2, label: label,
            data: {resource: label}
        });

        resources.push({
            id: lastNodeId, type: 'well', x: width / 2, y: height / 2, label: label,
            data: {num_wells: 1, container_name: '', well_addresses: '', volume: 1}
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
        links.push({
            source: sourceNode, target: nodes[i],
            data: getDefaultLinkData(true)
        });
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
            data: {operation: operation, selection: [], num_duplicates: 1}, parents: [sourceNode]
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
        startRepeat: startRepeat, deleteNode: deleteNode
    };
}