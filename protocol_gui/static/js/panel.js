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

function getContents(serialiseDiagram, selected_node, div) {
    var protocol_string = serialiseDiagram();

    $.ajax({
        type: "GET",
        contentType: "application/json; charset=utf-8",
        url: window.location.href + "/contents",
        dataType: 'json',
        async: true,
        data: {protocol_string: protocol_string, selected_node: selected_node.id},
        beforeSend: function (xhr) {
            xhr.setRequestHeader("X-CSRFToken", csrf_token);
        },
        success: function (res) {
            result = res;
            console.log(result);
            listContents(result, div);
        },
        error: function (result, textStatus) {
            console.log(result);
            console.log(textStatus);
        }
    });

}

function listContents(result, div) {

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


    addContainerSelect(selected_node, links, restart, form, deleteNode, serialiseDiagram)

    var div4 = form.append("div").classed("form-group", true);
    div4.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "wells")
        .text("Well locations:");

    div4.append("div")
        .classed("col-sm-5", true)
        .append("input")
        .attr("type", "text")
        .attr("id", "wells")
        .attr("name", "wells")
        .classed("form-control", true)
        .attr("value", selected_node.data.well_addresses)
        .on("change", function () {
            selected_node.data.well_addresses = this.value;
        });

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
            selected_link.data.num_duplicates = selected_link.data.num_duplicates;
        });

    duplicatesInput.selectAll('input').attr('disabled', selected_link.data.addToThis ? true : null);
    duplicatesInput.node().value = selected_link.data.num_duplicates;


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

    // Form to select samples
    var selection = selected_node.data.selection;

    var div2 = form.append("div");

    var selectionDivs = div2.selectAll("div")
        .data(selection)
        .enter()
        .append("div")
        .classed("form-group", true);

    var label = selectionDivs.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "Well");

    label.append("i").classed("fa", true).classed("fa-minus", true)
        .on("click", function (d, i) {
            selection.splice(i, 1);
            drawSelectPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram);
        });
    label.append("b").text(function (d, i) {
        return "Selection " + (i + 1) + ":";
    });

    selectionDivs.append("input")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "value")
        .attr("value", function (d) {
            return d;
        })
        .on("change", function () {
            var new_selection = [];
            var selectionInputs = selectionDivs.selectAll("input");
            for (var i = 0; i < selectionInputs.length; i++) {
                new_selection.push(parseFloat(selectionInputs[i][0].value))
            }
            selected_node.data.selection = new_selection;
        });


    // adding an extra volume
    div2.append("div")
        .classed("form-group", true)
        .append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .append("i").classed("fa", true).classed("fa-plus", true)
        .on("click", function () {
            selection.push(0);
            drawSelectPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram);
        });

    addDeleteButton(form, selected_node, deleteNode);
}

function drawOperationPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram) {
    form.append("h2").style().text("Operation");

    var div1 = form.append("div").classed("form-group", true);
    div1.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "container")
        .text("Container:");

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