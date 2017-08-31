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

    var container_name = ""
    if (queryNode.data.container_name) {
        container_name = queryNode.data.container_name;
    } else if (queryNode.data.hasOwnProperty("resource")) {
        container_name = resources.filter(function (d) {
            return d.label == queryNode.data.resource
        })[0].data.container_name;
    }

    if (container_name) {
        div.append("a")
            .text("Show or Set well locations")
            .on("click", function () {
                // need to make sure populationWellAssignmentModal isn't called until modal is shown
                // as we scale SVG to fit inside it
                $('#locationModal').one('shown.bs.modal', function () {
                    populationWellAssignmentModal(container_name, serialiseDiagram)
                });
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
            clearOperation(selected_node.id);
            selected_node.data.container_name = this.value;

            var contentsDiv = d3.select("#contents-div");
            if (selected_node && selected_node.type == "select") {
                getContents(serialiseDiagram, parentNode, contentsDiv, selectContents(selected_node));

            } else {
                getContents(serialiseDiagram, selected_node, contentsDiv);
            }

            restart(); // really only need to call recolorLabels
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

    // get the actual resource_node
    resource_node = resources.filter(function (n) {
        return n.label == selected_node.label
    })[0];

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
        .attr("value", resource_node.label)
        .on("change", function () {

            // rename all nodes
            var old_name = resource_node.label;
            var new_name = this.value;

            for (var i=0; i<nodes.length; i++){
                var node = nodes[i];
                if (node.type == "well" && node.label == old_name){
                    node.label = new_name;
                }
            }
            resource_node.label = new_name;
            restart();
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
        .attr("value", resource_node.data.num_wells)
        .on("change", function () {
            resource_node.data.num_wells = this.value;
            getContents(serialiseDiagram, resource_node, contentsDiv);
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
        .attr("value", resource_node.data.volume)
        .on("change", function () {
            resource_node.data.volume = this.value;
        });


    addContainerSelect(resource_node, links, restart, form, deleteNode, serialiseDiagram);

    var contentsDiv = form.append("div").attr("id", "contents-div");
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


    addContainerSelect(selected_node, links, restart, form, deleteNode, serialiseDiagram);

    var contentsDiv = form.append("div").attr("id", "contents-div");
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
        .text("Add to these wells");

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

            // clear location of aliquots produced by this operation
            clearOperation(selected_link.target.id);

            // if addToThis is now true, set location of aliquots produced by this operation to same as parents
            if (this.value == "Yes") {
                moveDescendents(selected_link.source.id, selected_link.target.id);
            }

            selected_link.target.data.container_name = selected_link.source.data.container_name;

            selected_link.data.addToThis = (this.value == "Yes");

            // toggle disabled-ness of volume and number of duplicates controls
            volumeDivs.selectAll('input').attr('disabled', selected_link.data.addToThis ? true : null);
            // toggle disabled-ness of control ver order of combination
            addFirstDiv.selectAll('input').attr('disabled', selected_link.data.addToThis ? true : null);

            restart();
        });

    containerSelect.append("option").text("Yes");
    containerSelect.append("option").text("No");
    containerSelect.node().value = (selected_link.data.addToThis ? "Yes" : "No");


    // Option to specify that one input should be added before the other
    var addFirstDiv = form.append("div").append("div")
        .classed("form-group", true);

    addFirstDiv.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "container")
        .text("Add this first");

    var addFirstCheckbox = addFirstDiv.append("input")
        .attr("type", "checkbox")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "addFirst")
        .attr("id", "addFirst")
        .on("change", function () {

            // ensure that no more than one link incident to the same node has addFirst true
            if (this.checked) {
                links.filter(function (x) {
                        return x.target.id == selected_link.target.id
                    })
                    .map(function (x) {
                        x.data.addFirst = false
                    });
            }

            selected_link.data.addFirst = this.checked;
            restart();
        });

    addFirstCheckbox.node().checked = selected_link.data.addFirst;

    // disable checkbox unless both inputs are being added to a new well
    links.filter(function (x) {
        return x.target.id == selected_link.target.id;
    }).map(function (link) {
        if (link.data.addToThis) {
            addFirstCheckbox.attr("disabled", true)
        }
    });


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

    label.append("b").text(function (d, i) {
        return "Volume:";
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
        .text("Change Tips:");

    var changeTipSelect = changeTipDiv.append("select")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "change-tips")
        .attr("id", "change-tips")
        .on("change", function () {
            selected_link.data.changeTips = this.value;

            distributeSelect.attr("disabled", (selected_link.data.changeTips == "always") ? "true" : null);

            restart();
        });

    changeTipSelect.append("option").attr("value", "always").text("Between every transfer");
    changeTipSelect.append("option").attr("value", "between-sources").text("When changing source well");
    changeTipSelect.append("option").attr("value", "never").text("Never");
    changeTipSelect.node().value = selected_link.data.changeTips;


    // Distribute
    var distributeDiv = form.append("div").append("div")
        .classed("form-group", true);

    distributeDiv.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "distribute")
        .text("Aspirate multiple transfers at once:");

    var distributeSelect = distributeDiv.append("select")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "distribute")
        .attr("id", "distribute")
        .on("change", function () {
            selected_link.data.distribute = this.value;
            restart();
        });

    distributeSelect.append("option").attr("value", true).text("Yes");
    distributeSelect.append("option").attr("value", true).text("No");
    distributeSelect.node().value = selected_link.data.distribute;

    if (selected_link.data.changeTips == "always") {
        distributeSelect.attr("disabled", true);
    }


    // Tip disposal
    var disposeTipDiv = form.append("div").append("div")
        .classed("form-group", true);

    disposeTipDiv.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "dispose-tips")
        .text("Discarded tips:");

    var disposeTipSelect = disposeTipDiv.append("select")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "dispose-tips")
        .attr("id", "dispose-tips")
        .on("change", function () {
            selected_link.data.disposeTips = this.value;
            restart();
        });

    disposeTipSelect.append("option").attr("value", "trash").text("Trash");
    disposeTipSelect.append("option").attr("value", "rack").text("Return to rack");
    disposeTipSelect.node().value = selected_link.data.disposeTips ? selected_link.data.disposeTips : "trash";

    // Blow-out
    var blowoutDiv = form.append("div").append("div")
        .classed("form-group", true);

    blowoutDiv.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "blowout")
        .text("Blow-out:");

    var blowoutSelect = blowoutDiv.append("select")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "blowout")
        .attr("id", "blowout")
        .on("change", function () {
            selected_link.data.blowout = this.value;
            restart();
        });

    blowoutSelect.append("option").attr("value", true).text("Yes");
    blowoutSelect.append("option").attr("value", false).text("No");
    blowoutSelect.node().value = selected_link.data.blowout;

    // Touch tip
    var touchTipDiv = form.append("div").append("div")
        .classed("form-group", true);

    touchTipDiv.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "touchTip")
        .text("Touch tip:");

    var touchTipSelect = touchTipDiv.append("select")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "touchTip")
        .attr("id", "touchTip")
        .on("change", function () {
            selected_link.data.touchTip = this.value;
            restart();
        });

    touchTipSelect.append("option").attr("value", true).text("Yes");
    touchTipSelect.append("option").attr("value", false).text("No");
    touchTipSelect.node().value = selected_link.data.touchTip;

    // Air gap
    var airgapDiv = form.append("div").append("div")
        .classed("form-group", true);

    airgapDiv.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "airgap")
        .text("Air gap:");

    var airgapInput = airgapDiv.append("input")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "airgap")
        .attr("id", "airgap")
        .on("change", function () {
            selected_link.data.airgap = this.value;
            restart();
        });

    airgapInput.node().value = selected_link.data.airgap;


    // Mix-before
    form.append("h4").text("Mix before");

    var mixBeforeDiv_1 = form.append("div").append("div")
        .classed("form-group", true);

    mixBeforeDiv_1.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "mixBefore-repeats")
        .text("Repeats");

    mixBeforeDiv_1.append("input")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "mixBefore-repeats")
        .attr("id", "mixBefore-repeats")
        .on("change", function () {
            mixBeforeDiv_2.select("input").attr('disabled', this.value == 0 ? 'true' : null);
            selected_link.data.mixBefore.repeats = this.value;
            restart();
        })

        .node().value = selected_link.data.mixBefore.repeats;

    var mixBeforeDiv_2 = form.append("div").append("div")
        .classed("form-group", true);

    mixBeforeDiv_2.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "mixBefore-volume")
        .text("Volume");

    mixBeforeDiv_2.append("input")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "mixBefore-volume")
        .attr("id", "mixBefore-volume")
        .on("change", function () {
            selected_link.data.mixBefore.volume = this.value;
            restart();
        })

        .node().value = selected_link.data.mixBefore.volume;

    if (selected_link.data.mixBefore.repeats == 0) {
        mixBeforeDiv_2.select("input").attr('disabled', true);
    }

    // Mix-after
    form.append("h4").text("Mix after");

    var mixAfterDiv_1 = form.append("div").append("div")
        .classed("form-group", true);

    mixAfterDiv_1.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "mixAfter-repeats")
        .text("Repeats");

    mixAfterDiv_1.append("input")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "mixAfter-repeats")
        .attr("id", "mixAfter-repeats")
        .on("change", function () {
            mixAfterDiv_2.select("input").attr('disabled', this.value == 0 ? 'true' : null);
            selected_link.data.mixAfter.repeats = this.value;
            restart();
        })

        .node().value = selected_link.data.mixAfter.repeats;

    var mixAfterDiv_2 = form.append("div").append("div")
        .classed("form-group", true);

    mixAfterDiv_2.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", "mixAfter-volume")
        .text("Volume");

    mixAfterDiv_2.append("input")
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", "mixAfter-volume")
        .attr("id", "mixAfter-volume")
        .on("change", function () {
            selected_link.data.mixAfter.volume = this.value;
            restart();
        })

        .node().value = selected_link.data.mixAfter.volume;

    if (selected_link.data.mixAfter.repeats == 0) {
        mixAfterDiv_2.select("input").attr('disabled', true);
    }


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
    addContainerSelect(selected_node, links, restart, form, deleteNode, serialiseDiagram);

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


    var contentsDiv = form.append("div").attr("id", "contents-div");
    getContents(serialiseDiagram, selected_node, contentsDiv);


    addDeleteButton(form, selected_node, deleteNode);
}

function drawSelectPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram) {
    form.selectAll("div").remove();
    form.selectAll("h2").remove();

    form.append("h2").style().text("Select");

    // Set container
    addContainerSelect(selected_node, links, restart, form, deleteNode, serialiseDiagram)

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
        });

    duplicatesInput.node().value = selected_node.data.num_duplicates;


    // Note that the user selects from the contents of the parent node, not the contents of the selected node
    // (which consists only of what the user has selected)
    var contentsDiv = form.append("div").attr("id", "contents-div");
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


    var contentsDiv = form.append("div").attr("id", "contents-div");
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