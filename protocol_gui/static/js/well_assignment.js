var selected_container, color, located_nodes;
var max_col, max_row;
var num_aliquots = [];
var container_data;
var xScale, yScale, y_max;

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
    located_nodes = nodes.filter(function (node) {
        return node.data.container_name == container_name;
    });


    var div = d3.select("#locationModal").select("#well-list");
    var color = d3.scale.category10().domain(located_nodes.length);

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
        data.push({contents: result[i], aliquot_index: i, operation_index: queryNode.id});
    }

    var outer_list = div
        .append("ol")
        .style("margin-top", "20px")
        .style("border-left", "5px solid " + getColors(queryNode.id))
        .on("mouseover", function () {
            if (!single_well_highlighted) {
                for (var i = 0; i < result.length; i++) {
                    var d = data[i];
                    if (getLocation(d.operation_index, d.aliquot_index)) {
                        highlightWell(d, true)
                    }
                }
            }
        })
        .on("mouseout", resetAppearances)
        ;

    outer_list.attr("draggable", true)
        .on("dragstart", function (d, i) {

            // A drag event on the ol item corresponding set of wells will also
            // be triggered if a single well is dragged
            if (!draggingSingleWell) {
                var ev = d3.event;
                ev.dataTransfer.setData("custom-data", queryNode.id + ",");
            }
        })
        .on("drop", function (a, b, c) {
        });

    var outer_list_items = outer_list
        .selectAll("li")
        .data(data)
        .enter()
        .append("li").style("margin-top", "10px")

        .classed("well-contents", true)

        .append("ul")

        .attr("draggable", true)
        .on("dragstart", function (d, i) {
            var ev = d3.event;
            ev.dataTransfer.setData("custom-data", queryNode.id + "," + i);
            draggingSingleWell = true;
        })
        .on("drop", function (a, b, c) {
            draggingSingleWell = false;
        })
        .on("mouseover", function (d) {

            single_well_highlighted = true;

            resetAppearances(); // clear any highlighting of whole set of wells
            if (getLocation(d.operation_index, d.aliquot_index)) {
                highlightWell(d)
            }
        })
        .on("mouseout", function () {
            single_well_highlighted = false;
            resetAppearances();
        })
        ;

    var items = outer_list_items.selectAll("li")
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

    var containerURL = "https://raw.githubusercontent.com/OpenTrons/opentrons-api/master/api/opentrons/config/containers/default-containers.json";

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

    // Pick the width such that it fits horizontally, then pick height so x and y scales are the same
    var width = document.getElementById("well-diagram").offsetWidth;
    var height = (2 * padding) + (width - 2 * padding) * (yExtent[1] - yExtent[0]) / (xExtent[1] - xExtent[0]);

    d3.select("#locationModal").select("#well-diagram").selectAll("svg").remove();
    var svg = d3.select("#locationModal").select("#well-diagram")
        .append("svg").attr("width", width).attr("height", height)
        .on("dragover", function (d) {
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

    var circles = g.selectAll("circle")
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
        .style("fill", "white")
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


    g.selectAll("rect")
        .data(data.filter(function (d) {
            return d.width
        }))
        .enter()
        .append("rect")
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
        .style("stroke-width", "2px");


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
    var operation_index = data[0];
    var aliquot_index = data[1];

    var location = d.name;
    var col = location[0];
    var row = location.substr(1);

    var num_wells = num_aliquots[operation_index];


    var operation = nodes.filter(function (n) {
        return n.id == operation_index;
    })[0];

    if (draggingSingleWell) {
        if (d.container.contents[d.name]) {
            return;
        } // ensure well is empty

        // if already placed somewhere else, remove from there first
        clearWell(operation_index, aliquot_index);
        setWellContents(d.container, d.name, operation_index, aliquot_index);
        resetAppearances();
        draggingSingleWell = false;

    } else if (wellPlacementMode == "Row") {

        for (aliquot_index = 0; aliquot_index < num_wells; aliquot_index++) {
            clearWell(operation_index, aliquot_index);
        }
        aliquot_index = 0;

        while (aliquot_index < num_wells) {

            location = col + row;

            if (!d.container.contents[location]) {
                setWellContents(d.container, location, operation_index, aliquot_index);
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
            clearWell(operation_index, aliquot_index);
        }
        aliquot_index = 0;

        while (aliquot_index < num_wells) {

            location = col + row;

            if (!d.container.contents[location]) {
                setWellContents(d.container, location, operation_index, aliquot_index);
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
        // TOOO: enable rectangular fill

    } else if (wellPlacementMode == "Rect 2") {
        // TOOO: enable rectangular fill
    }
}


function clearWell(operation_index, aliquot_index) {
    var oldLocation = getLocation(operation_index, aliquot_index);
    if (oldLocation) {
        delete selected_container.contents[oldLocation];
    }
}

function setWellContents(container, well_name, operation_index, aliquot_index) {

    var indexes = [parseInt(operation_index)];

    for (var i = 0; i < links.length; i++) {
        var link = links[i];
        if (link.data.addToThis) {

            if (link.source.id == operation_index) {
                indexes.push(link.target.id);
            } else if (link.target.id == operation_index) {
                indexes.push(link.source.id);
            }
        }
    }

    container.contents[well_name] = indexes.map(function (operation_index) {
        return {operation_index: operation_index, aliquot_index: aliquot_index}
    });
}

function clearOperation(operation_index) {
    // Clear locations of all aliquots corresponding to a particular operation
    for (var i = 0; i < containers.length; i++) {
        var container = containers[i];
        for (var well in container.contents) {
            container.contents[well] = container.contents[well].filter(function (x) {
                return x.operation_index != operation_index;
            });
        }
    }
}

function moveDescendents(source_operation_index, target_operation_index) {
    // Set location of all aliquots produced by an operation to the locations occupied by another operation
    for (var i = 0; i < containers.length; i++) {
        var container = containers[i];
        for (var well in container.contents) {
            var contents = container.contents[well];

            for (var j = 0; j < contents.length; j++) {
                if (contents[j].operation_index == source_operation_index) {
                    contents.push({operation_index: target_operation_index, aliquot_index: contents[j].aliquot_index})
                }
            }
        }
    }
}

function resetAppearances() {
    // adjusts appearances of wells/aliquots to show whether they are full/have been assigned positions

    var containerDiagram = d3.select("#container_group");

    containerDiagram.selectAll("circle")
        .style("stroke", "black").style("stroke-width", "2px");

    // Color wells to indicate their contents
    d3.selectAll(".pie-group").remove();
    for (var name in container_data.locations) {
        var datum = container_data.locations[name];

        var contents = '';
        if (selected_container.contents && selected_container.contents[name]) {
            drawWell(selected_container.contents[name], xScale(datum.x), yScale(y_max - datum.y))
        }

    }

    containerDiagram.selectAll("rect")
        .style("fill", function (d) {
            return selected_container.contents[d.name] ? "black" : "white";
        });

    d3.selectAll(".well-contents").style("color", function (d) {
            return getLocation(d.operation_index, d.aliquot_index) ? 'grey' : 'black';
        })
        .style("border-left", "none");
}


function getLocation(operation_index, aliquot_index) {

    for (var well in selected_container.contents) {
        var contents = selected_container.contents[well];

        for (var i = 0; i < contents.length; i++) {
            var c = contents[i];
            if (c.operation_index == operation_index && c.aliquot_index == aliquot_index) {
                return well;
            }
        }

    }
    return "";
}


function highlightWell(contents, highlightWholeSet) {
    // Highlight circle

    var wellName = getLocation(contents.operation_index, contents.aliquot_index);

    d3.select("#locationModal").selectAll("circle")
        .filter(function (d) {
            return d.name == wellName;
        })
        .style("stroke", "yellow").style("stroke-width", "7px");

    // highlight content list
    d3.select("#locationModal")
        //.select(".id", "node-" + contents.operation_index) // get right set of aliauots
        .selectAll(".well-contents")
        .style("border-left", function (d) {
            if (d.operation_index == contents.operation_index && (d.aliquot_index == contents.aliquot_index || highlightWholeSet)) {
                return "5px solid yellow";
            } else {
                return "";
            }
        })
}

function drawWell(contents, x, y) {

    var radius = 10;

    var arc = d3.svg.arc()
        .innerRadius(0)
        .outerRadius(radius);

    var g = d3.select("#container_group")
        .append("g")
        .attr("transform", "translate(" + x + ", " + y + ")")
        .classed("pie-group", true);

    var path = g.selectAll('.arcs')
        .data(contents.map(function (content, i) {
            return {
                id: parseInt(content.operation_index),
                startAngle: i * (2 * Math.PI / contents.length),
                endAngle: (i + 1) * (2 * Math.PI / contents.length),
                padding: 0
            };
        }))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', function (d) {
            return color(d.id);
        });
}