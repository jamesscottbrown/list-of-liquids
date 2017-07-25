var selected_container, color, located_nodes;
var max_col, max_row;
var num_aliquots = [];

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
                        highlightWell(d)
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
        var container_data = containerData['containers'][container.type];
        drawContainer(container_data, container);
    });


}


function drawContainer(container_data, container) {
    var padding = 50;

    var data = [];

    var letters = [];
    var letter_names = [];
    var digits = [];
    var digit_names = [];
    var y_max = 0;

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

    var xScale = d3.scale.linear().range([padding, width - padding])
        .domain(xExtent);
    var yScale = d3.scale.linear().range([padding, height - padding])
        .domain(yExtent);

    if (!container_data["origin-offset"]) {
        container_data["origin-offset"] = {x: 20, y: 20};
    }

    var g = svg.append("g").attr("transform", "translate(" + container_data["origin-offset"].x + ", " + container_data["origin-offset"].y + ")")

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
        d.container.contents[d.name] = {operation_index: operation_index, aliquot_index: aliquot_index};

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
                d.container.contents[location] = {operation_index: operation_index, aliquot_index: aliquot_index};
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
                d.container.contents[location] = {operation_index: operation_index, aliquot_index: aliquot_index};
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

function resetAppearances() {
    // adjusts appearances of wells/aliquots to show whether they are full/have been assigned positions

    d3.selectAll("circle")
        .style("fill", function (d) {
            var contents = selected_container.contents[d.name];
            return contents ? getColors(contents.operation_index) : "white";
        });


    d3.selectAll("rect")
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
        var c = selected_container.contents[well];

        if (c.operation_index == operation_index && c.aliquot_index == aliquot_index) {
            return well;
        }
    }
    return "";
}


function highlightWell(contents) {
    // Highlight circle

    var wellName = getLocation(contents.operation_index, contents.aliquot_index);

    d3.select("#locationModal").selectAll("circle")
        .filter(function (d) {
            return d.name == wellName;
        })
        .style("fill", "yellow");

    // highlight content list
    d3.select("#locationModal")
        //.select(".id", "node-" + contents.operation_index) // get right set of aliauots
        .selectAll(".well-contents")
        .filter(function (d) {
            return d.aliquot_index == contents.aliquot_index && d.operation_index == contents.operation_index;
        })
        .style("border-left", "5px solid yellow");
}

