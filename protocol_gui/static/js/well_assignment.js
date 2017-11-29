var selected_container, color, located_nodes;
var max_col, max_row;
var num_aliquots = [];
var container_data;

var wellPlacementMode = "";
setWellMode("Row");

var draggingSingleWell = false;
var single_well_highlighted = false;

function setWellMode(mode) {
    d3.select("#wellRow").style("border", mode == "Row" ? "1px red solid" : "");
    d3.select("#wellCol").style("border", mode == "Col" ? "1px red solid" : "");
    d3.select("#wellRect1").style("border", mode == "Rect1" ? "1px red solid" : "");
    d3.select("#wellRect2").style("border", mode == "Rect2" ? "1px red solid" : "");

    wellPlacementMode = mode;
}


function populationWellAssignmentModal(container_name, serialiseDiagram) {

    selected_container = containers.filter(function (d) {
        return d.name == container_name
    })[0];

    d3.select("#locationModal").select(".modal-title").text("Well assignments for " + container_name);

    var div = d3.select("#locationModal").select("#well-list");

    div.node().innerHTML = "";

    drawContainerDiagram(selected_container);
    listContentsOfContainer(container_name, serialiseDiagram);
}


function listContentsOfContainer(container_name, serialiseDiagram) {


    located_nodes = [];
    var processed_resources = [];

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];

        if (node.type == "resource") {
            var resource = resources.filter(function (r) {
                return r.label == node.data.resource
            })[0];
            if (resource.data.container_name == container_name && processed_resources.indexOf(node.label) == -1) {
                processed_resources.push(node.label);
                located_nodes.push(node);
            }

        } else if (node.data.container_name == container_name) {
            located_nodes.push(node);
        }


    }


    var div = d3.select("#locationModal").select("#well-list");

    for (var i = 0; i < located_nodes.length; i++) {
        getContents(serialiseDiagram, located_nodes[i], div, listContainerContents);
    }
}

function getColors(nodeId) {
    var index = 0;
    for (var i = 0; i < located_nodes.length; i++) {
        if (located_nodes[i].id == nodeId) {
            index = i;
        }
    }
    return color(index);
}

function listContainerContents(result, div, queryNode) {

    //d3.select("#node-" + queryNode.id).remove();
    var newDiv = div.append("div").attr("id", "node-" + queryNode.id);

    num_aliquots[queryNode.id] = result.length;

    var data = [];
    for (var i = 0; i < result.length; i++) {
        data.push({contents: result[i], aliquot_index: i, node_id: queryNode.id});
    }

    var outer_list = div
            .append("ol")
            .style("margin-top", "20px")
            .style("border-left", "5px solid " + getColors(queryNode.id))
            .on("mouseover", function () {
                if (!single_well_highlighted) {
                    for (var i = 0; i < result.length; i++) {
                        var d = data[i];
                        if (getLocation(d.node_id, d.aliquot_index)) {
                            highlightWell([d], true)
                        }
                    }
                }
            })
            .on("mouseout", resetAppearances);

    outer_list.append('i')
        .attr('id', 'collapse-icon')
        .attr('class', "fa fa-minus")
        .style("margin-left", "-30px")
        .on("click", function () {
            if (d3.select(this).classed("fa-minus")) {
                d3.select(this.parentNode).selectAll('li').style('display', 'none');
                d3.select(this).attr('class', "fa fa-plus")
            } else {
                d3.select(this.parentNode).selectAll('li').style('display', 'block');
                d3.select(this).attr('class', "fa fa-minus")
            }
        });

    outer_list.append("button")
        .text(" Clear")
        .on("click", function(){
            clearOperation(queryNode.id);
        });

    outer_list.attr("draggable", true)
        .on("dragstart", function () {

            // A drag event on the ol item corresponding set of wells will also
            // be triggered if a single well is dragged
            if (!draggingSingleWell) {
                var ev = d3.event;
                ev.dataTransfer.setData("custom-data", queryNode.id + ",");
            }
        })
        .on("drop", function () {
        });

    var outer_list_items = outer_list
            .selectAll("li")
            .data(data)
            .enter()
            .append("li")
            .style("margin-top", "10px")
            .classed("well-contents", true)
            .append("ul")
            .attr("draggable", true)
            .on("dragstart", function (d, i) {
                var ev = d3.event;
                ev.dataTransfer.setData("custom-data", queryNode.id + "," + i);
                draggingSingleWell = true;
            })
            .on("drop", function () {
                draggingSingleWell = false;
            })
            .on("mouseover", function (d) {

                single_well_highlighted = true;

                resetAppearances(); // clear any highlighting of whole set of wells
                if (getLocation(d.node_id, d.aliquot_index)) {
                    highlightWell([d])
                }
            })
            .on("mouseout", function () {
                single_well_highlighted = false;
                resetAppearances();
            })
        ;

    outer_list_items.selectAll("li")
        .data(function (d) {
            return d.contents
        })
        .enter()
        .append("li")
        .text(function (d) {
            return d;
        });
    resetAppearances();
}

function drawContainerDiagram(container) {

    var containerURL = "../../static/default-containers.json";

    d3.json(containerURL, function (error, containerData) {
        container_data = containerData['containers'][container.type];
        drawContainer(container);
    });


}


function drawContainer(container) {
    var padding = 50;

    var data = [];

    var letters = [];
    var letter_names = [];
    var digits = [];
    var digit_names = [];
    y_max = 0;

    for (var name in container_data.locations) {
        var datum = container_data.locations[name];

        var contents = '';
        if (container.contents && container.contents[name]) {
            contents = container.contents[name];
        }

        data.push({
            name: name,
            x: datum.x,
            y: datum.y,
            diameter: datum.diameter,
            length: datum.length,
            width: datum.width,
            contents: contents,
            container: container
        });

        var letter = name[0];
        if (letter_names.indexOf(letter) == -1) {
            letters.push({text: letter, x: datum.x});
            letter_names.push(letter);
        }

        var digit = name.substr(1);
        if (digit_names.indexOf(digit) == -1) {
            digits.push({text: digit, y: datum.y});
            digit_names.push(digit);
        }

        if (datum.y > y_max) {
            y_max = datum.y;
        }
    }

    max_col = letter_names.sort()[letter_names.length - 1];
    max_row = digit_names.length;

    var xExtent = d3.extent(data.map(function (d) {
        return d.x;
    }));

    var yExtent = d3.extent(data.map(function (d) {
        return d.y;
    }));


    if (xExtent[1] > xExtent[0]) {
        // Pick the width such that it fits horizontally, then pick height so x and y scales are the same
        var width = document.getElementById("well-diagram").offsetWidth;
        var height = (2 * padding) + (width - 2 * padding) * (yExtent[1] - yExtent[0]) / (xExtent[1] - xExtent[0]);
    } else {
        // All wells in trough have the same x-coordinate
        var width = document.getElementById("well-diagram").offsetWidth;
        var height = 0;
        for (var well in container_data.locations) {
            height += 25;
        }
    }

    d3.select("#well-list").style("max-height", (window.innerHeight - 300)+ "px" );

    d3.select("#locationModal").select("#well-diagram").selectAll("svg").remove();
    var svg = d3.select("#locationModal").select("#well-diagram")
        .append("svg").attr("width", width).attr("height", height)
        .on("dragover", function () {
            d3.event.preventDefault();
        });

    xScale = d3.scale.linear().range([padding, width - padding])
        .domain(xExtent);
    yScale = d3.scale.linear().range([padding, height - padding])
        .domain(yExtent);

    if (!container_data["origin-offset"]) {
        container_data["origin-offset"] = {x: 20, y: 20};
    }

    var g = svg.append("g")
        .attr("transform", "translate(" + container_data["origin-offset"].x + ", " + container_data["origin-offset"].y + ")")
        .attr("id", "container_group");

    d3.select("#container_group")
        .selectAll(".pie-group")
        .data(data)
        .enter()
        .append("g")
        .attr("transform", function (d) {
            return "translate(" + xScale(d.x) + ", " + yScale(y_max - d.y) + ")";
        })
        .classed("pie-group", true)
        .attr("id", function (d) {
            return "pie-" + d.name;
        });

    g.selectAll("circle")
        .data(data.filter(function (d) {
            return d.diameter
        }))
        .enter()
        .append("circle")
        .attr("r", function (d) {
            return xScale(d.diameter / 2) - xScale(0);
        })
        .attr("cx", function (d) {
            return xScale(d.x);
        })
        .attr("cy", function (d) {
            return yScale(y_max - d.y);
        })
        .attr("title", function (d) {
            return d.name;
        })
        .style("fill", "white").style("fill-opacity", 0)// N.B. if fill is "none", context menu and dropping break
        .style("stroke", "black")
        .style("stroke-width", "2px")

        .on("mouseover", function (d) {
            var contents = selected_container.contents[d.name];
            if (contents) {
                highlightWell(contents);
            }
        })
        .on("mouseout", resetAppearances)
        .on("drop", function (d) {
            placeWells(d)
        })
        .on("contextmenu", d3.contextMenu(function (d) {
            return [{
                title: 'Clear',
                disabled: !selected_container.contents[d.name],
                action: function (elm, d) {
                    delete selected_container.contents[d.name];
                    resetAppearances();
                }
            }]
        }));


    g.selectAll(".rect-container")
        .data(data.filter(function (d) {
            return d.width
        }))
        .enter()
        .append("rect")
        .classed("rect-container", true)
        .attr("x", function (d) {
            return xScale(d.x);
        })
        .attr("y", function (d) {
            return yScale(y_max - d.y);
        })
        .attr("width", function (d) {
            return d.width;
        })

        .attr("height", function (d) {
            return d.length;
        })
        .attr("title", function (d) {
            return d.name;
        })
        .style("stroke", "black")
        .style("stroke-width", "2px")
        .style("fill", "white").style("fill-opacity", 0)// N.B. if fill is "none", context menu and dropping break
        .on("mouseover", function (d) {
            var contents = selected_container.contents[d.name];
            if (contents) {
                highlightWell(contents);
            }
        })
        .on("mouseout", resetAppearances)
        .on("drop", function (d) {
            placeWells(d)
        })
        .on("contextmenu", d3.contextMenu(function (d) {
            return [{
                title: 'Clear',
                disabled: !selected_container.contents[d.name],
                action: function (elm, d) {
                    delete selected_container.contents[d.name];
                    resetAppearances();
                }
            }]
        }));


    var g_columns = svg.append("g").attr("transform", "translate(" + container_data["origin-offset"].x + ", 0)");

    g_columns.selectAll("text")
        .data(letters)
        .enter()
        .append("text")
        .attr("y", 5)
        .attr("x", function (d) {
            return xScale(d.x);
        })
        .text(function (d) {
            return d.text;
        })
        .style("font-size", "5pt");


    var g_rows = svg.append("g").attr("transform", "translate(0, " + container_data["origin-offset"].y + ")");

    g_rows.selectAll("text")
        .data(digits)
        .enter()
        .append("text")
        .attr("x", 0)
        .attr("y", function (d) {
            return yScale(y_max - d.y);
        })
        .text(function (d) {
            return d.text;
        })
        .style("font-size", "5pt");

    resetAppearances();
}


function placeWells(d) {
    var data = d3.event.dataTransfer.getData("custom-data").split(","); // add well
    var node_id = data[0];
    var aliquot_index = data[1];

    var location = d.name;
    var col = location[0];
    var row = location.substr(1);

    var num_wells = num_aliquots[node_id];

    if (draggingSingleWell) {
        if (d.container.contents[d.name]) {
            return;
        } // ensure well is empty

        // if already placed somewhere else, remove from there first
        clearWell(node_id, aliquot_index);
        setWellContents(d.container, d.name, node_id, aliquot_index);
        resetAppearances();
        draggingSingleWell = false;

    } else if (wellPlacementMode == "Row") {

        for (aliquot_index = 0; aliquot_index < num_wells; aliquot_index++) {
            clearWell(node_id, aliquot_index);
        }
        aliquot_index = 0;

        while (aliquot_index < num_wells) {

            location = col + row;

            if (!d.container.contents[location]) {
                setWellContents(d.container, location, node_id, aliquot_index);
                aliquot_index += 1;
            }

            // increment location along row
            if (col == max_col && row > 1) {
                col = "A";
                row = row - 1;
            } else if (col == max_col && row == 1) {
                break;
            }
            else {
                col = String.fromCharCode(col.charCodeAt(0) + 1);
            }

        }
        resetAppearances();


    } else if (wellPlacementMode == "Col") {

        for (aliquot_index = 0; aliquot_index < num_wells; aliquot_index++) {
            clearWell(node_id, aliquot_index);
        }
        aliquot_index = 0;

        while (aliquot_index < num_wells) {

            location = col + row;

            if (!d.container.contents[location]) {
                setWellContents(d.container, location, node_id, aliquot_index);
                aliquot_index += 1;
            }

            // increment location along column
            if (row > 1) {
                row = row - 1;
            } else if (col == max_col) {
                break;
            } else {
                col = String.fromCharCode(col.charCodeAt(0) + 1);
                row = max_row;
            }
        }
        resetAppearances();

    } else if (wellPlacementMode == "Rect1") {
        placeWellsRect(placeWellsRect1, row, col, d, node_id);
    } else if (wellPlacementMode == "Rect2") {
        placeWellsRect(placeWellsRect2, row, col, d, node_id);

    }
}


function placeWellsRect(placementFunc, row, col, d, node_id) {
    var incident_links = links.filter(function (l) {
        return l.target.id == node_id;
    });
    var parents = incident_links.map(function (l) {
        return l.source
    });


    var protocol_string = serialiseDiagram();
    $.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        url: window.location.href + "contents",
        dataType: 'json',
        async: true,
        data: JSON.stringify({protocol_string: protocol_string, selected_node: parents[0].id}),
        beforeSend: function (xhr) {
            xhr.setRequestHeader("X-CSRFToken", csrf_token);
        },
        success: function (res) {
            result = res;
            placeWellsRectInner(result, parents[1], protocol_string, row, col, d, node_id, placementFunc);
        },
        error: function (result, textStatus) {
            console.log("Failed to get contents: " + result);
            console.log(textStatus);
        }
    });
}

function placeWellsRectInner(contents1, queryNode, protocol_string, row, col, d, node_id, placementFunc) {
    $.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        url: window.location.href + "contents",
        dataType: 'json',
        async: true,
        data: JSON.stringify({protocol_string: protocol_string, selected_node: queryNode.id}),
        beforeSend: function (xhr) {
            xhr.setRequestHeader("X-CSRFToken", csrf_token);
        },
        success: function (res) {
            result = res;
            placementFunc(contents1, result, row, col, d, node_id);
        },
        error: function (result, textStatus) {
            console.log("Failed to get contents: " + result);
            console.log(textStatus);
        }
    });
}

function placeWellsRect1(contents1, contents2, row, col, d, node_id) {
    var location;
    var current_row;

    var num_wells = num_aliquots[node_id];
    for (var aliquot_index = 0; aliquot_index < num_wells; aliquot_index++) {
        clearWell(node_id, aliquot_index);
    }
    aliquot_index = 0;

    for (var i = 0; i < contents1.length; i++) {
        current_row = row;

        for (var j = 0; j < contents2.length; j++) {
            location = col + current_row;

            delete selected_container.contents[location];
            setWellContents(d.container, location, node_id, aliquot_index);
            aliquot_index += 1;
            current_row = current_row - 1;
        }
        col = String.fromCharCode(col.charCodeAt(0) + 1);
    }
    resetAppearances();

}

function placeWellsRect2(contents1, contents2, row, col, d, node_id) {
    var location;
    var current_col;

    var num_wells = num_aliquots[node_id];
    for (var aliquot_index = 0; aliquot_index < num_wells; aliquot_index++) {
        clearWell(node_id, aliquot_index);
    }
    aliquot_index = 0;

    for (var i = 0; i < contents1.length; i++) {
        current_col = col;

        for (var j = 0; j < contents2.length; j++) {
            location = current_col + row;
            
            delete selected_container.contents[location];
            setWellContents(d.container, location, node_id, aliquot_index);
            aliquot_index += 1;

            current_col = String.fromCharCode(current_col.charCodeAt(0) + 1);
        }
        row = row - 1;
    }
    resetAppearances();

}


function clearWell(node_id, aliquot_index) {
    var oldLocation = getLocation(node_id, aliquot_index);
    if (oldLocation) {
        delete selected_container.contents[oldLocation];
    }
}

function findColocatedNodes(node_id, downwards_only){
    var indexes = [];
    var nodes_to_examine = [parseInt(node_id)];

    while (nodes_to_examine.length > 0){

        var id = nodes_to_examine[0];

        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            if (link.data.addToThis) {

                var source_id = link.source.id;
                var target_id = link.target.id;

                if (source_id == id && nodes_to_examine.indexOf(target_id) == -1 && indexes.indexOf(target_id) == -1) {
                    nodes_to_examine.push(target_id);
                }

                if (!downwards_only && target_id == id && nodes_to_examine.indexOf(source_id) == -1 && indexes.indexOf(source_id) == -1) {
                    nodes_to_examine.push(source_id);
                }
            }
        }

        indexes.push( nodes_to_examine.shift() )
    }
    return indexes;
}

function setWellContents(container, well_name, node_id, aliquot_index) {

    // Do breadth-first transversal of network to finds all nodes that share locations due to 'addToThis'
    var indexes = findColocatedNodes(node_id);

    container.contents[well_name] = indexes.map(function (node_id) {
        return {node_id: node_id, aliquot_index: aliquot_index}
    });
}

function clearOperation(node_id) {
    // Clear locations of all aliquots corresponding to a particular operation
    for (var i = 0; i < containers.length; i++) {
        var container = containers[i];
        for (var well in container.contents) {
            container.contents[well] = container.contents[well].filter(function (x) {
                return x.node_id != node_id;
            });

            if (container.contents[well].length == 0 ){
                delete container.contents[well];
            }
        }
    }
}

    function toggleLinkAddtothisStatus(selected_link, addToThis){

        if (addToThis) {

            // ensure that no more than one link incident to the same node has addToThis true
            links.filter(function (x) {
                    return x.target.id == selected_link.target.id
                })
                .map(function (x) {
                    x.data.addToThis = false
                });

            selected_link.data.addToThis = true;

            // Also need tp ensure that target node, and any of it's descendents linked by a chain of addToThis links
            // have same container, and consistent well assignment with source node of this link

            var parent_node = nodes.filter(function (d) {
                return d.id == selected_link.source.id;
            })[0];
            var parentContainer = containers.filter(function (d) {
                return d.name == parent_node.data.container_name
            })[0];


            // find location of each aliquot for parent nodes
            var assigned_wells = [];
            for (var well in parentContainer.contents) {
                var well_contents = parentContainer.contents[well];
                for (var i = 0; i < well_contents.length; i++) {
                    if (well_contents[i].node_id == parent_node.id) {
                        assigned_wells[well_contents[i].aliquot_index] = well;
                    }
                }
            }

            // assign all aliquots of descendent nodes to same location
            var coLocatedNodeIds = findColocatedNodes(selected_link.target.id, true);
            coLocatedNodeIds.push(selected_link.target.id);

            for (var i = 0; i < coLocatedNodeIds.length; i++) {
                // change container
                var node = nodes.filter(function (d) {
                    return d.id == coLocatedNodeIds[i];
                })[0];
                node.data.container_name = parent_node.data.container_name;// getNodeContainer(node);

                // clear well-assignments
                clearOperation(coLocatedNodeIds[i]);

                // re-set well-assignments
                for (var aliquot_index = 0; aliquot_index < assigned_wells.length; aliquot_index++) {
                    var well_name = assigned_wells[aliquot_index];
                    if (well_name) {
                        parentContainer.contents[well_name].push({node_id: node.id, aliquot_index: aliquot_index})
                    }
                }
            }

        } else {

            selected_link.data.addToThis = false;

            // clear the well assignment of all downstream nodes, but leave containers set
            var coLocatedNodeIds = findColocatedNodes(selected_link.target.id, true);
            for (var i = 0; i < coLocatedNodeIds.length; i++) {
                clearOperation(coLocatedNodeIds[i]);
            }
        }
    }

function resetAppearances() {
    // adjusts appearances of wells/aliquots to show whether they are full/have been assigned positions

    var containerDiagram = d3.select("#container_group");

    containerDiagram.selectAll("circle")
        .style("stroke", "black").style("stroke-width", "2px");

    // Color wells to indicate their contents
    d3.selectAll(".pie-group").selectAll("path").remove();
    d3.selectAll(".pie-group").selectAll("rect").remove();

    for (var name in container_data.locations) {
        if (selected_container.contents && selected_container.contents[name]) {
            drawWell(selected_container.contents[name], name)
        }
    }

    containerDiagram.selectAll(".rect-container")
        .style("stroke", "black").style("stroke-width", "2px");

    d3.selectAll(".well-contents").style("color", function (d) {
        return getLocation(d.node_id, d.aliquot_index) ? 'grey' : 'black';
    })
        .style("border-left", "none");
}


function getLocation(node_id, aliquot_index) {

    for (var well in selected_container.contents) {
        var contents = selected_container.contents[well];

        for (var i = 0; i < contents.length; i++) {
            var c = contents[i];
            if (c.node_id == node_id && c.aliquot_index == aliquot_index) {
                return well;
            }
        }

    }
    return "";
}


function highlightWell(contents_list, highlightWholeSet) {

    d3.select("#locationModal")
        .selectAll(".well-contents")
        .style("border-left", "");

    for (var i = 0; i < contents_list.length; i++) {
        var contents = contents_list[i];

        var wellName = getLocation(contents.node_id, contents.aliquot_index);

        if (container_data.locations[wellName].width) {
            d3.select("#locationModal").selectAll(".rect-container")
                .filter(function (d) {
                    return d.name == wellName;
                })
                .style("stroke", "yellow").style("stroke-width", "3px");

        } else {
            d3.select("#locationModal").selectAll("circle")
                .filter(function (d) {
                    return d.name == wellName;
                })
                .style("stroke", "yellow").style("stroke-width", "7px");
        }


        d3.select("#locationModal")
            .selectAll(".well-contents")
            .filter(function (d) {
                return d.node_id == contents.node_id && (d.aliquot_index == contents.aliquot_index || highlightWholeSet)
            })
            .style("border-left", "5px solid yellow");
    }
}

function drawWell(contents, name) {

    if (container_data.locations[name].width){
        drawWellRect(contents, name);
    } else {
         drawWellCirc(contents, name);
    }
}

function drawWellCirc(contents, name){
     var radius = 10;

    var arc = d3.svg.arc()
        .innerRadius(0)
        .outerRadius(radius);

    var g = d3.select("#pie-" + name);

    g.selectAll('.arcs')
        .data(contents.map(function (content, i) {
            return {
                id: parseInt(content.node_id),
                startAngle: i * (2 * Math.PI / contents.length),
                endAngle: (i + 1) * (2 * Math.PI / contents.length),
                padding: 0
            };
        }))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', function (d) {
            return getColors(d.id);
        });
}

function drawWellRect(contents, name) {
    var g = d3.select("#pie-" + name);

    var width = container_data.locations[name].width;
    var height = container_data.locations[name].length;

    g.selectAll('rect')
        .data(contents)
        .enter()
        .append('rect')
        .attr("x", function (d, i) {
            return i * (width / contents.length)
        })
        .attr("width", (width / contents.length))
        .attr("y", "0")
        .attr("height", height)
        .style('fill', function (d) {
            return getColors(d.node_id);
        });
}

