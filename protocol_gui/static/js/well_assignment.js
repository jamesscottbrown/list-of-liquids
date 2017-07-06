var selected_container;

function populationWellAssignmentModal(container_name, serialiseDiagram) {

    selected_container = containers.filter(function (d) {
        return d.name == container_name
    })[0];

    d3.select("#locationModal").select(".modal-title").text("Well assignments for " + container_name);

    drawContainerDiagram(selected_container);
    listContentsOfContainer(container_name, serialiseDiagram);
}


function listContentsOfContainer(container_name, serialiseDiagram) {
    var located_nodes = nodes.filter(function (node) {
        return node.data.container_name == container_name;
    });


    var div = d3.select("#locationModal").select("#well-list");

    // TODO: fix clearing
    div.selectAll("div").remove();
    div.selectAll("li").remove();
    div.selectAll("ul").remove();
    div.selectAll("ol").remove();
    div.selectAll("h4").remove();


    for (var i = 0; i < located_nodes.length; i++) {
        getContents(serialiseDiagram, located_nodes[i], div, listContainerContents);
    }
}

function listContainerContents(result, div, queryNode) {

    //d3.select("#node-" + queryNode.id).remove();
    var newDiv = div.append("div").attr("id", "node-" + queryNode.id);

    var data = [];
    for (var i = 0; i < result.length; i++) {
        data.push({contents: result[i], aliquot_index: i, operation_index: queryNode.id});
    }

    newDiv.append("h4").text("Node " + queryNode.id);

    var outer_list_items = div
        .append("ol")
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
        })
        .on("drop", function (a, b, c) {
            console.log("Dropped");
        })
        .on("mouseover", function (d) {

            if (getLocation(d.operation_index, d.aliquot_index)) {
                highlightWell(d)

            }
        })
        .on("mouseout", resetAppearances)
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

            if (d.container.contents[d.name]) {
                return;
            } // ensure well is empty

            var data = d3.event.dataTransfer.getData("custom-data").split(","); // add well
            var operation_index = data[0];
            var aliquot_index = data[1];

            // if already placed somewhere else, remove from there first
            var oldLocation = getLocation(operation_index, aliquot_index);
            if (oldLocation) {
                delete selected_container.contents[oldLocation];
            }

            d.container.contents[d.name] = {operation_index: operation_index, aliquot_index: aliquot_index};

            resetAppearances();
        })
        .on("contextmenu", d3.contextMenu(function (d) {
            return [{
                title: 'Clear',
                disabled: !d.contents,
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

function resetAppearances() {
    // adjusts appearances of wells/aliquots to show whether they are full/have been assigned positions

    d3.selectAll("circle")
        .style("fill", function (d) {
            return selected_container.contents[d.name] ? "black" : "white";
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

