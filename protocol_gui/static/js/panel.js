function updateDescriptionPanel(selected_node, selected_link, selected_group, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram) {

    // TODO: rather than calling restart(), redraw single label
    var info = d3.select("#info");
    info.select("form").remove();

    if (!selected_node && !selected_link && !selected_group) {
        return;
    }

    var form = info.append("form")
        .classed("form-horizontal", true)
        .classed("info-box", true)
        .attr("onsubmit", "return false;");

    if (selected_node && selected_node.type == "well") {
        drawWellPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram);
    } else if (selected_node && selected_node.type == "aliquot") {
        drawAliquotPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram)
    } else if (selected_node && selected_node.type == "process") {
        drawProcessPanel(selected_node, restart, form, deleteNode);
    } else if (selected_node && selected_node.type == "pool") {
        drawPoolPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram);
    } else if (selected_node && selected_node.type == "select") {
        drawSelectPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram);
    } else if (selected_node) {
        drawOperationPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram);
    } else if (selected_group) {
        drawRepeatPanel(selected_group, form)
    } else if (selected_link) {
        drawTransferPanel(selected_node, selected_link, links, restart, redrawLinkLabels, form);
    }
}

function getContents(serialiseDiagram, queryNode, div, drawFunction) {
    var protocol_string = serialiseDiagram();

    if (!drawFunction) {
        drawFunction = listContents;
    }

    $.ajax({
        type: "GET",
        contentType: "application/json; charset=utf-8",
        url: window.location.href + "contents",
        dataType: 'json',
        async: true,
        data: {protocol_string: protocol_string, selected_node: queryNode.id},
        beforeSend: function (xhr) {
            xhr.setRequestHeader("X-CSRFToken", csrf_token);
        },
        success: function (res) {
            result = res;
            console.log(result);
            drawFunction(result, div, queryNode, serialiseDiagram);
        },
        error: function (result, textStatus) {
            console.log(result);
            console.log(textStatus);
        }
    });

}


function listContents(result, div, queryNode, serialiseDiagram) {

    div.node().innerHTML = "";

    div.append("h3").text("Contents");

    var outer_list_items = div
        .append("ol")
        .selectAll("li")
        .data(result)
        .enter()
        .append("li").style("margin-top", "10px")
        .append("ul");


    var items = outer_list_items.selectAll("li")
        .data(function (d) {
            return d
        })
        .enter()
        .append("li")
        .text(function (d) {
            return d;
        });

    if (queryNode.data.container_name) {
        div.append("a")
            .text("Show or Set well locations")
            .on("click", function () {
                // need to make sure populationWellAssignmentModal isn't called until modal is shown
                // as we scale SVG to fit inside it
                $('#locationModal').one('shown.bs.modal', function(){populationWellAssignmentModal(queryNode.data.container_name, serialiseDiagram)});
                $('#locationModal').modal('toggle');
            });

    } else {
        div.append("p").text("To set well locations you must first set the container")
    }
}


function selectContents(selected_node) {
    return function (result, div) {

        // add index to results
        for (var i = 0; i < result.length; i++) {
            result[i].index = i;
        }

        // if necessary, extend or truncate list of which nodes are selected
        while (selected_node.data.selection.length < result.length) {
            selected_node.data.selection.push(false);
        }

        while (selected_node.data.selection.length > result.length) {
            selected_node.data.selection.pop();
        }

        div.append("h3").text("Contents");

        var outer_list_divs = div
            .append("ol")
            .selectAll("div")
            .data(result)
            .enter()
            .append("div").classed("checkbox", "true").attr("name", function (d) {
                return "checkbox_contents_" + d.index;
            });


        outer_list_divs
            .append("input").attr("type", "checkbox").attr("checked", function (d) {
                return selected_node.data.selection[d.index] ? 'checked' : null;
            })
            .on("change", function (d) {
                selected_node.data.selection[d.index] = this.checked;
            });

        var items = outer_list_divs.append("ul").selectAll("li")
            .data(function (d) {
                return d
            })
            .enter()
            .append("li")
            .text(function (d) {
                return d;
            });
    }
}


function addDeleteButton(form, selected_node, deleteNode) {
    form.append("div")
        .classed("form-group", true)
        .append("div")
        .classed("col-sm-5", true)

        .append("button")
        .on("click", function () {
            deleteNode(selected_node)
        })
        .text("Delete ").append("i").classed("fa", true).classed("fa-trash-o", true);
}

function addContainerSelect(selected_node, links, restart, form, deleteNode, serialiseDiagram) {
    var div3 = form.append("div").classed("form-group", true);
    div3.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "container-name")
        .text("Container:");


    var containerInput = div3.append("div")
        .classed("col-sm-5", true)
        .append("select")
        .attr("type", "text")
        .attr("id", "container-name")
        .attr("name", "container-name")
        .classed("form-control", true)
        .property("value", selected_node.data.container_name)
        .on("change", function () {
            selected_node.data.container_name = this.value;
        });

    containerInput.selectAll("option").data(containers)
        .enter()
        .append("option")
        .attr("id", function (d) {
            return d.name;
        })
        .text(function (d) {
            return d.name;
        });

    // N.B. need to add the options to the select before the value can be set
    containerInput.property("value", selected_node.data.container_name);


    var updateDescriptionPanelCallback = function () {
        updateDescriptionPanel(selected_node, null, null, links, restart, null, deleteNode, serialiseDiagram);
    };

    div3.append("b").classed("fa", true).classed("fa-plus", true)
        .style("color", "#337ab7")
        .on("click", function () {
            addContainer(updateDescriptionPanelCallback)
        });

    return containerInput;
}

// Functions to draw specific types of panel:

function drawWellPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram) {
    form.append("h2").style().text("Initially present resource");

    var div1 = form.append("div").classed("form-group", true);
    div1.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "name")
        .text("Name:");

    div1.append("div")
        .classed("col-sm-5", true)
        .append("input")
        .attr("type", "text")
        .attr("name", "name")
        .classed("form-control", true)
        .attr("value", selected_node.label)
        .on("change", function () {
            selected_node.label = this.value;
            restart();
            console.log(nodes)
        });


    var div2 = form.append("div").classed("form-group", true);
    div2.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "num-wells")
        .text("Number of wells:");

    div2.append("div")
        .classed("col-sm-5", true)

        .append("input")
        .attr("type", "text")
        .attr("id", "num-wells")
        .attr("name", "num-wells")
        .classed("form-control", true)
        .attr("value", selected_node.data.num_wells)
        .on("change", function () {
            selected_node.data.num_wells = this.value;
            getContents(serialiseDiagram, selected_node, contentsDiv);
        });


    var div2a = form.append("div").classed("form-group", true);
    div2a.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "volume")
        .text("Volume per well:");

    div2a.append("div")
        .classed("col-sm-5", true)

        .append("input")
        .attr("type", "text")
        .attr("id", "volume")
        .attr("name", "volume")
        .classed("form-control", true)
        .attr("value", selected_node.data.volume)
        .on("change", function () {
            selected_node.data.volume = this.value;
        });


    addContainerSelect(selected_node, links, restart, form, deleteNode, serialiseDiagram);

    var contentsDiv = form.append("div");
    getContents(serialiseDiagram, selected_node, contentsDiv);
    addDeleteButton(form, selected_node, deleteNode);
}


function drawAliquotPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram) {
    form.append("h2").style().text("Aliquot");

    var div1 = form.append("div").classed("form-group", true);
    div1.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "name")
        .text("Name:");

    div1.append("div")
        .classed("col-sm-5", true)
        .append("input")
        .attr("type", "text")
        .attr("name", "name")
        .classed("form-control", true)
        .attr("value", selected_node.label)
        .on("change", function () {
            selected_node.label = this.value;
            restart();
            console.log(nodes)
        });


    addContainerSelect(selected_node, links, restart, form, deleteNode, serialiseDiagram);

    var contentsDiv = form.append("div");
    getContents(serialiseDiagram, selected_node, contentsDiv);

    addDeleteButton(form, selected_node, deleteNode);
}

function drawTransferPanel(selected_node, selected_link, links, restart, redrawLinkLabels, form) {

    form.selectAll("div").remove();
    form.selectAll("h2").remove();

    var title;
    if (selected_link.source.type == "well") {
        title = "Transfer of " + selected_link.source.label;
    } else {
        title = "Transfer"
    }

    form.append("h2").style().text(title);


    // Form to set whether we are adding to this
    var containerDiv = form.append("div").append("div")
        .classed("form-group", true);

    containerDiv.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "container")
        .text("Add to this container");

    var containerSelect = containerDiv.append("select")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "container")
        .attr("id", "container")
        .on("change", function () {

            // ensure that no more than one link incident to the same node has addToThis true
            if (this.value == "Yes") {
                links.filter(function (x) {
                        return x.target.id == selected_link.target.id
                    })
                    .map(function (x) {
                        x.data.addToThis = false
                    });
            }

            selected_link.target.data.container_name = selected_link.source.data.container_name;

            selected_link.data.addToThis = (this.value == "Yes");

            // toggle disabled-ness of volume and number of duplicates controls
            volumeDivs.selectAll('input').attr('disabled', selected_link.data.addToThis ? true : null);
            duplicatesDiv.selectAll('input').attr('disabled', selected_link.data.addToThis ? true : null);

            restart();
        });

    containerSelect.append("option").text("Yes");
    containerSelect.append("option").text("No");
    containerSelect.node().value = (selected_link.data.addToThis ? "Yes" : "No");


    // Form to specify which pipette to use
    var pipetteDiv = form.append("div").append("div")
        .classed("form-group", true);

    pipetteDiv.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "pipette")
        .text("Pipette: ");

    var pipetteInput = pipetteDiv
        .append("select")
        .classed("col-sm-5", true)
        .classed("control-input", true)
        .attr("name", "pipette")
        .attr("value", selected_link.data.pipette_name)
        .on("change", function () {
            selected_link.data.pipette_name = this.value;
            restart();
        });

    pipetteInput.selectAll("option").data(pipettes)
        .enter()
        .append("option")
        .attr("id", function (d) {
            return d.name;
        })
        .text(function (d) {
            return d.name;
        });

    // N.B. need to add the options to the select before the value can be set
    pipetteInput.property("value", selected_link.data.pipette_name);

    // Create new pipette if plus sign is clicked
    var updateDescriptionPanelCallback = function () {
        updateDescriptionPanel(selected_node, selected_link, null, links, restart, redrawLinkLabels, null, null)
    };
    pipetteDiv.append("b")
        .classed("fa", true).classed("fa-plus", true)
        .style("color", "#337ab7")
        .on("click", function () {
            addPipette(updateDescriptionPanelCallback);
        });


    // Form to set whether we are changing tips
    var changeTipDiv = form.append("div").append("div")
        .classed("form-group", true);

    changeTipDiv.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "change-tips")
        .text("Change Tips");

    var changeTipSelect = changeTipDiv.append("select")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "change-tips")
        .attr("id", "change-tips")
        .on("change", function () {
            selected_link.data.changeTips = (this.value == "Yes");
            restart();
        });

    changeTipSelect.append("option").text("Yes");
    changeTipSelect.append("option").text("No");
    changeTipSelect.node().value = (selected_link.data.changeTips ? "Yes" : "No");


    // Form to set whether we are changing tips
    var mixDiv = form.append("div").append("div")
        .classed("form-group", true);

    mixDiv.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "change-tips")
        .text("Mix");

    var mixSelect = mixDiv.append("select")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "change-tips")
        .attr("id", "change-tips")
        .on("change", function () {
            selected_link.data.mix = (this.value == "Yes");
            restart();
        });

    mixSelect.append("option").text("Yes");
    mixSelect.append("option").text("No");
    mixSelect.node().value = (selected_link.data.mix ? "Yes" : "No");


    // Form to adjust volumes
    var volumes = selected_link.data.volumes;

    var div2 = form.append("div");

    var volumeDivs = div2.selectAll("div")
        .data(volumes)
        .enter()
        .append("div")
        .classed("form-group", true);

    var label = volumeDivs.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "volume");

    label.append("i").classed("fa", true).classed("fa-minus", true)
        .on("click", function (d, i) {
            volumes.splice(i, 1);
            drawTransferPanel(selected_node, selected_link, links, restart, redrawLinkLabels, form);
            redrawLinkLabels();
        });
    label.append("b").text(function (d, i) {
        return "Volume " + (i + 1) + ":";
    });

    volumeDivs.append("input")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "value")
        .attr("value", function (d) {
            return d;
        })
        .on("change", function () {
            var new_volumes = [];
            var volumeInputs = volumeDivs.selectAll("input");
            for (var i = 0; i < volumeInputs.length; i++) {
                new_volumes.push(parseFloat(volumeInputs[i][0].value))
            }
            selected_link.data.volumes = new_volumes;
            redrawLinkLabels();
        });

    if (selected_link.data.addToThis) {
        volumeDivs.selectAll('input').attr('disabled', true);
    }

    // adding an extra volume
    div2.append("div")
        .classed("form-group", true)
        .append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .append("i").classed("fa", true).classed("fa-plus", true)
        .on("click", function () {
            volumes.push(0);
            drawTransferPanel(selected_node, selected_link, links, restart, redrawLinkLabels, form);
            redrawLinkLabels();
        });
}

function drawProcessPanel(selected_node, restart, form, deleteNode) {
    form.append("h2").style().text("Processing step");

    var div1 = form.append("div").classed("form-group", true);
    div1.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "name")
        .text("Name:");

    div1.append("div")
        .classed("col-sm-5", true)

        .append("input")
        .attr("type", "text")
        .attr("name", "name")
        .attr("value", selected_node.label)
        .on("change", function () {
            selected_node.label = this.value;
            restart();
        });

    var div2 = form.append("div").classed("form-group", true);
    div2.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "options")
        .text("Options:");

    div2.append("div")
        .classed("col-sm-8", true)
        .append("textarea")
        .attr("cols", "80")
        .attr("rows", "20")
        .attr("name", "options")
        .text(selected_node.data)
        .on("change", function () {
            selected_node.data = this.value;
            restart();
        });

    addDeleteButton(form, selected_node, deleteNode);
}

function drawPoolPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram) {
    form.append("h2").style().text("Pool samples together");
    addContainerSelect(selected_node, links, restart, form, deleteNode, serialiseDiagram)
    addDeleteButton(form, selected_node, deleteNode);
}

function drawSelectPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram) {
    form.selectAll("div").remove();
    form.selectAll("h2").remove();

    form.append("h2").style().text("Select");

    // Set container
    addContainerSelect(selected_node, links, restart, form, deleteNode, serialiseDiagram)


    // Note that the user selects from the contents of the parent node, not the contents of the selected node
    // (which consists only of what the user has selected)
    var contentsDiv = form.append("div");
    var parentNode = links.filter(function (x) {
        return x.target == selected_node
    })[0].source;
    getContents(serialiseDiagram, parentNode, contentsDiv, selectContents(selected_node));

    addDeleteButton(form, selected_node, deleteNode);
}

function drawOperationPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram) {
    form.append("h2").style().text("Operation");

    var containerInput = addContainerSelect(selected_node, links, restart, form, deleteNode, serialiseDiagram)

    // If incident edge has 'addToThis' true, ensure container_name for this is consistent with this
    // and disable field to prevent it being changed
    var container = false;
    for (var i = 0; i < links.length; i++) {
        if (links[i].target.id == selected_node.id && links[i].data.addToThis) {
            selected_node.data.container_name = links[i].source.data.container_name;
            containerInput.node().value = selected_node.data.container_name;
            containerInput.attr("disabled", "");
            break;
        }
    }

    // Form to set number of duplicates
    var duplicatesDiv = form.append("div").append("div")
        .classed("form-group", true);

    duplicatesDiv.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "duplicates")
        .text("Number of duplicates");

    var duplicatesInput = duplicatesDiv.append("input")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "duplicates")
        .attr("id", "duplicates")
        .on("change", function () {
            selected_node.data.num_duplicates = this.value;
            getContents(serialiseDiagram, selected_node, contentsDiv);
        });

    duplicatesInput.node().value = selected_node.data.num_duplicates;


    var contentsDiv = form.append("div");
    getContents(serialiseDiagram, selected_node, contentsDiv);

    addDeleteButton(form, selected_node, deleteNode);
    // TODO: options menu to change type (alternative to context menu)
    // TODO: display of resulting aliquots


}

function drawRepeatPanel(selected_group, form) {
    form.append("h2").style().text("Repeat");

    var div1 = form.append("div").classed("form-group", true);
    div1.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "repeats")
        .text("Repeats:");

    var repeatInput = div1.append("div")
        .classed("col-sm-5", true)
        .append("input")
        .attr("type", "text")
        .attr("name", "repeats")
        .attr("value", selected_group.data.repeats)
        .on("change", function () {
            selected_node.selected_group.repeats = this.value;
        });

}