function updateDescriptionPanel(selected_node, selected_link, links, restart, redrawLinkLabels, deleteNode, serialiseDiagram) {

    // TODO: rather than calling restart(), redraw single label
    var info = d3.select("#info");
    info.select("form").remove();

    if (!selected_node && !selected_link) {
        return;
    }

    var form = info.append("form")
        .classed("form-horizontal", true)
        .classed("info-box", true)
        .attr("onsubmit", "return false;");

    if (selected_node && selected_node.type == "resource") {
        drawResourcePanel(selected_node, links, restart, form, deleteNode, serialiseDiagram);
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
            console.log(result);
            drawFunction(result, div, queryNode, serialiseDiagram);
        },
        error: function (result, textStatus) {
            console.log(result);
            console.log(textStatus);
        }
    });

}


function listContents(result, parentDiv, queryNode, serialiseDiagram) {

    parentDiv.node().innerHTML = "";
    var div = parentDiv.append("div");
    div.node().innerHTML = "";

    div.append("h3").text("Contents")

        .append('i')
        .attr('class', "fa fa-minus")
        //.style("margin-left", "-30px")
        .on("click", function () {
            if (d3.select(this).classed("fa-minus")) {
                d3.select(this.parentNode.parentNode).selectAll('ol').style('display', 'none');
                d3.select(this).attr('class', "fa fa-plus")
            } else {
                d3.select(this.parentNode.parentNode).selectAll('ol').style('display', 'block');
                d3.select(this).attr('class', "fa fa-minus")
            }
        });


    div.style("max-height", parseInt(d3.select("#network-svg").attr("height"))-200 + "px" ).style("overflow-y", "scroll");


    var outer_list_items = div
        .append("ol")
        .selectAll("li")
        .data(result)
        .enter()
        .append("li").style("margin-top", "10px")
        .append("ul");

    outer_list_items.selectAll("li")
        .data(function (d) {
            return d
        })
        .enter()
        .append("li")
        .text(function (d) {
            return d;
        });

    var container_name = "";
    if (queryNode.data.container_name) {
        container_name = queryNode.data.container_name;
    } else if (queryNode.data.hasOwnProperty("resource")) {
        container_name = resources.filter(function (d) {
            return d.label == queryNode.data.resource
        })[0].data.container_name;
    }

    if (container_name) {
        parentDiv.append("a")
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
        parentDiv.append("p").text("To set well locations you must first set the container")
    }

}

function addFieldAndLabel(parentDiv, name, label_text, fieldType){

    var div = parentDiv.append("div").append("div")
        .classed("form-group", true);

    div.append("label")
        .classed("control-label", true)
        .classed("col-sm-5", true)
        .attr("for", name)
        .text(label_text);

    return div.append(fieldType)
        .classed("control-input", true)
        .classed("col-sm-5", true)
        .attr("name", name)
        .attr("id", name);
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

        outer_list_divs.append("ul").selectAll("li")
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

            var newContainerName = this.value;
            if (selected_node.type == "resource"){
                var resource = resources.filter(function(r){return r.label == selected_node.data.resource})[0];
               resource.data.container_name = newContainerName;
            } else {
               selected_node.data.container_name = newContainerName;
            }


            var container = containers.filter(function(c){return c.name == newContainerName})[0];
            if (container.type == "trash-box"){
                if (!container.contents.A1){
                    container.contents.A1 = [];
                }

                for (var i=0; i < d3.select("#contents-div").selectAll("ul")[0].length; i++){
                    // TODO: get number of aliquots in a less brittle way
                    container.contents.A1.push({node_id: selected_node.id, aliquot_index: i})
                }
            }


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
    if (selected_node.type == "resource"){
        var resource = resources.filter(function(r){return r.label == selected_node.data.resource})[0];
           containerInput.property("value", resource.data.container_name);
    } else {
           containerInput.property("value", selected_node.data.container_name);
    }




    var updateDescriptionPanelCallback = function () {
        updateDescriptionPanel(selected_node, null, links, restart, null, deleteNode, serialiseDiagram);
    };

    div3.append("b").classed("fa", true).classed("fa-plus", true)
        .style("color", "#337ab7")
        .on("click", function () {
            addContainer(updateDescriptionPanelCallback)
        });

    return containerInput;
}

// Functions to draw specific types of panel:

function drawResourcePanel(selected_node, links, restart, form, deleteNode, serialiseDiagram) {
    form.append("h2").style().text("Initially present resource");

    // get the actual resource_node
    resource_node = resources.filter(function (n) {
        return n.label == selected_node.label
    })[0];

    addFieldAndLabel(form, "name", "Name:", "input")
        .attr("type", "text")
        .attr("value", resource_node.label)
        .on("change", function () {

            // rename all nodes
            var old_name = resource_node.label;
            var new_name = this.value;

            for (var i=0; i<nodes.length; i++){
                var node = nodes[i];
                if (node.type == "resource" && node.label == old_name){
                    node.label = new_name;
                    node.data.resource = new_name;
                }
            }
            resource_node.label = new_name;

            // rename corresponding resource object
            for (var i=0; i<resources.length; i++){
                if (resources[i].label == old_name){
                    resources[i].label == new_name;
                }
            }

            restart();
        });

    addFieldAndLabel(form, "num-wells", "Number of wells:", "input")
        .attr("type", "text")
        .attr("value", resource_node.data.num_wells)
        .on("change", function () {
            resource_node.data.num_wells = this.value;
            getContents(serialiseDiagram, resource_node, contentsDiv);
        });

    addFieldAndLabel(form, "volume", "Volume per well:", "input")
        .attr("type", "text")
        .attr("value", resource_node.data.volume)
        .on("change", function () {
            resource_node.data.volume = this.value;
        });


    addContainerSelect(selected_node, links, restart, form, deleteNode, serialiseDiagram);

    var contentsDiv = form.append("div").attr("id", "contents-div");
    getContents(serialiseDiagram, selected_node, contentsDiv);
    addDeleteButton(form, selected_node, deleteNode);
}


function drawAliquotPanel(selected_node, links, restart, form, deleteNode, serialiseDiagram) {
    form.append("h2").style().text("Aliquot");

    addFieldAndLabel(form, "name", "Name:", "input")
        .attr("type", "text")
        .attr("value", selected_node.label)
        .on("change", function () {
            selected_node.label = this.value;
            restart();
            console.log(nodes)
        });


    // Form to set number of duplicates
    var duplicatesInput = addFieldAndLabel(form, "duplicates", "Number of duplicates:", "input")
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
    if (selected_link.source.type == "resource") {
        title = "Transfer of " + selected_link.source.label;
    } else {
        title = "Transfer"
    }

    form.append("h2").style().text(title);


    // Form to set whether we are adding to this
    var containerSelect = addFieldAndLabel(form, "container", "Add to these wells:", "select")
        .on("change", function () {
            toggleLinkAddtothisStatus(selected_link, this.value == "Yes");

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

    label.append("b").text("Volume:");

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
                new_volumes.push(volumeInputs[i][0].value) // TODO: allow multiple volumes only if parent has unique contents
            }


            var protocol_string = serialiseDiagram();
                $.ajax({
                    type: "POST",
                    contentType: "application/json; charset=utf-8",
                    url: window.location.href + "contents",
                    dataType: 'json',
                    async: true,
                    data: JSON.stringify({protocol_string: protocol_string, selected_node: selected_link.source.id}),
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader("X-CSRFToken", csrf_token);
                    },
                    success: function (res) {
                        result = res;

                        // volumes is an array that contains one element
                        // if node at source of arrow contains only one thing, don't cast to float, allowing multiple volumes as a comma-separated string like ["10,20"]
                        if (res[0].length > 1){
                            new_volumes[0] = parseFloat(new_volumes[0]);
                            selected_link.data.volumes = new_volumes;
                        } else {
                            selected_link.data.volumes = new_volumes;
                        }

                        volumeInputs[0][0].value = new_volumes[0]; // update input box
                        redrawLinkLabels(); // update diagram

                        console.log(result);
                        //placeWellsRectInner(result, parents[1], protocol_string, row, col, d, operation_index, placementFunc);
                    },
                    error: function (result, textStatus) {
                        console.log(result);
                        console.log(textStatus);
                    }
                });


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
        updateDescriptionPanel(selected_node, selected_link, links, restart, redrawLinkLabels, null, null)
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
    var distributeSelect = addFieldAndLabel(form, "distribute", "Aspirate multiple transfers at once:", "select")
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
    var disposeTipSelect = addFieldAndLabel(form, "dispose-tips", "Discarded tips:", "select")
        .on("change", function () {
            selected_link.data.disposeTips = this.value;
            restart();
        });

    disposeTipSelect.append("option").attr("value", "trash").text("Trash");
    disposeTipSelect.append("option").attr("value", "rack").text("Return to rack");
    disposeTipSelect.node().value = selected_link.data.disposeTips ? selected_link.data.disposeTips : "trash";

    // Blow-out
    var blowoutSelect = addFieldAndLabel(form, "blowout", "Blow-out:", "select")
        .on("change", function () {
            selected_link.data.blowout = this.value;
            restart();
        });

    blowoutSelect.append("option").attr("value", true).text("Yes");
    blowoutSelect.append("option").attr("value", false).text("No");
    blowoutSelect.node().value = selected_link.data.blowout;

    // Touch tip
    var touchTipSelect =  addFieldAndLabel(form, "touchTip", "Touch tip:", "select")
        .on("change", function () {
            selected_link.data.touchTip = this.value;
            restart();
        });

    touchTipSelect.append("option").attr("value", true).text("Yes");
    touchTipSelect.append("option").attr("value", false).text("No");
    touchTipSelect.node().value = selected_link.data.touchTip;

    // Air gap
    var airgapInput = addFieldAndLabel(form, "airgap", "Air gap:", "input")
        .on("change", function () {
            selected_link.data.airgap = this.value;
            restart();
        });

    airgapInput.node().value = selected_link.data.airgap;


    // Mix-before
    form.append("h4").text("Mix before");

    addFieldAndLabel(form, "mixBefore-repeats", "Repeats:", "input")
        .on("change", function () {
            mixBeforeDiv_2.select("input").attr('disabled', this.value == 0 ? 'true' : null);
            selected_link.data.mixBefore.repeats = this.value;
            restart();
        })

        .node().value = selected_link.data.mixBefore.repeats;

    addFieldAndLabel(form, "mixBefore-volume", "Volume:", "input")
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

    addFieldAndLabel(form, "mixAfter-repeats", "Repeats:", "input")
        .on("change", function () {
            mixAfterDiv_2.select("input").attr('disabled', this.value == 0 ? 'true' : null);
            selected_link.data.mixAfter.repeats = this.value;
            restart();
        })
        .node().value = selected_link.data.mixAfter.repeats;

    addFieldAndLabel(form, "mixAfter-volume", "Volume:", "input")
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
    form.node().innerHTML = "";
    form.append("h2").style().text("Processing step");


    var process_types = [
        {label: "Wait", value: "wait", acts_on: "container"},
        {label: "Turn magdeck on", value: "magdeck_on", acts_on: "container"},  // no extra options
        {label: "Turn magdeck off", value: "magdeck_off", acts_on: "container"}, // no extra options

        {label: "Centrifuge", value: "spin", acts_on: "container"},

        {label: "Cover", value: "cover", acts_on: "container"},
        {label: "Uncover", value: "uncover", acts_on: "container"}, // no extra options
        {label: "Seal", value: "seal", acts_on: "container"}, // no extra options
        {label: "Unseal", value: "unseal", acts_on: "container"}, // no extra options
        {label: "Incubate", value: "incubate", acts_on: "container"},
        // {label: "Spread", value: "spread"}, // this is a to/from liquid transfer
        // {label: "Autopick", value: "autopick"}, // this is also really a kind of transfer
        {label: "Thermocycle", value: "thermocycle", acts_on: "container"},

        {label: "Fluorescence", value: "fluorescence", acts_on: "well"}, // https://developers.transcriptic.com/docs/spectrophotometry
        {label: "Absorbance", value: "absorbance", acts_on: "well"}, // https://developers.transcriptic.com/docs/spectrophotometry
        {label: "Luminescence", value: "luminescence", acts_on: "well"}, // https://developers.transcriptic.com/docs/spectrophotometry
        {label: "Gel separate", value: "gel_separate", acts_on: "well"}
        ];

    // select object storing options for this operation
    var process_type = selected_node.data.process_type;
    var data = operations.filter(function(g){ return g.leaves.indexOf(selected_node) != -1 })[0].data;


    // Add select box to change operation type
    addFieldAndLabel(form, "name", "Name:", "input")
        .attr("type", "text")
        .attr("value", selected_node.label)
        .on("change", function () {
            selected_node.label = this.value;
            restart();
        });

    var type_select = addFieldAndLabel(form, "type", "Operation type:", "select")
        .attr("type", "text")
        .on("change", function () {
            // delete data from node
            data.options = {};

            var process_type = this.value;

            // update other nodes in same group
            var operation = operations.filter(function(o){return o.leaves.indexOf(selected_node) != -1; })[0];
            for (var i=0; i<operation.leaves.length; i++){
                operation.leaves[i].data.process_type = process_type;
            }

            selected_node.data.process_type = process_type;
            operation.data.acts_on = process_types.filter(function(d){return d.value == process_type})[0].acts_on;

            // update drawing to reflect change to operations (really only need to redrawGroups)
            restart();

            // redraw panel
            drawProcessPanel(selected_node, restart, form, deleteNode);
        });


    type_select.selectAll("option").data(process_types)
        .enter()
        .append("option")
        .attr("value", function(d){ return d.value; })
        .text(function(d){ return d.label; });
    type_select.node().value = selected_node.data.process_type;


    if (process_type === "wait"){

        addFieldAndLabel(form, "duration", "Duration:", "input")
            .attr("type", "text")
            .on("change", function () {
                data.duration = this.value;
                restart();
            })
            .node().value = data.duration;

    } else if (process_type === "spin"){

        addFieldAndLabel(form, "duration", "Duration:", "input")
            .attr("type", "text")
            .on("change", function () {
                data.duration = this.value;
                restart();
            })
            .node().value = data.duration;

        addFieldAndLabel(form, "acceleration", "Acceleration:", "input")
            .attr("type", "text")
            .on("change", function () {
                data.acceleration = this.value;
                restart();
            })
            .node().value = data.acceleration;

    } else if (process_type === "cover") {
        var lid_types = [
            {label: "standard", value: "standard"},
            {label: "universal", value: "universal"},
            {label: "low_evaporation", value: "low_evaporation"}];

        var lid_select = addFieldAndLabel(form, "lid-type", "Lid type:", "select")
            .attr("type", "text")
            .on("change", function () {
                data.lid_type = this.value
            });

        lid_select.selectAll("option").data(lid_types)
            .enter()
            .append("option")
            .attr("value", function(d){ return d.value; })
            .text(function(d){ return d.label; });

        lid_select.node().value = selected_node.data.lid_type;

    } else if (process_type === "incubate") {
        // where, duration, shaking

        var where_options = ["ambient", "warm_37", "cold_4", "cold_20", "cold_80"];

        var where_select = addFieldAndLabel(form, "where", "Where:", "select")
            .attr("type", "text")
            .on("change", function () {
                data.where = this.value
            });

        where_select.selectAll("option").data(where_options)
            .enter()
            .append("option")
            .attr("value", function (d) {
                return d;
            })
            .text(function (d) {
                return d;
            });

        where_select.node().value = selected_node.data.where;

        addFieldAndLabel(form, "duration", "Duration:", "input")
            .attr("type", "text")
            .on("change", function () {
                data.duration = this.value;
                restart();
            })
            .node().value = data.duration;


        var shaking_options = [
            {label: "Yes", value: true},
            {label: "No", value: false}];

        var shaking_select = addFieldAndLabel(form, "shaking_options", "Shaking:", "input")
            .on("change", function () {
                data.shaking = this.value
            });

        shaking_select.selectAll("option").data(shaking_options)
            .enter()
            .append("option")
            .attr("value", function (d) {
                return d;
            })
            .text(function (d) {
                return d;
            });

        shaking_select.node().value = data.shaking;

    } else if (process_type === "thermocycle") {

        addFieldAndLabel(form, "volume", "Volume:", "input")
            .on("change", function () {
                data.volume = this.value
            })
            .node().value = data.volume;

        addFieldAndLabel(form, "schedule", "Schedule:", "textarea")
            .on("change", function () {
                data.schedule = this.value
            })
            .node().value = data.schedule;

        form.append("p")
            .text("Example: 3 times (12C for 5 min, 13C for 5 min), 6 times (20C for 2 min, 8C for 6 min)");

        form.append("p")
            .text("Time may be in units 'min', 's', or 'h'");

    } else if (process_type === "absorbance") {

        // excitation, emission, num_flashes,

        addFieldAndLabel(form, "wavelength", "Wavelength (nm):", "input")
            .on("change", function () {
                data.wavelength = this.value
            })
            .node().value = data.wavelength;

        addFieldAndLabel(form, "num_flashes", "Number of flashes:", "input")
            .on("change", function () {
                data.num_flashes = this.value
            })
            .node().value = data.num_flashes;

        addFieldAndLabel(form, "dataref", "Dataref:", "input")
            .on("change", function () {
                data.dataref = this.value
            })
            .node().value = data.dataref;

    } else if (process_type === "fluorescence") {

        // excitation, emission, num_flashes,

        addFieldAndLabel(form, "excitation", "Excitation wavelength (nm):", "input")
            .on("change", function () {
                data.excitation = this.value
            })
            .node().value = data.excitation;

        addFieldAndLabel(form, "emission", "Emission wavelength (nm):", "input")
            .on("change", function () {
                data.emission = this.value
            })
            .node().value = data.emission;

        addFieldAndLabel(form, "num_flashes", "Number of flashes:", "input")
            .on("change", function () {
                data.num_flashes = this.value
            })
            .node().value = data.num_flashes;

        addFieldAndLabel(form, "dataref", "Dataref:", "input")
            .on("change", function () {
                data.dataref = this.value
            })
            .node().value = data.dataref;

        addFieldAndLabel(form, "temperature", "Temperature:", "input")
            .on("change", function () {
                data.temperature = this.value
            })
            .node().value = data.temperature;

    } else if (process_type === "luminescence") {

        addFieldAndLabel(form, "dataref", "Dataref:", "input")
            .on("change", function () {
                data.dataref = this.value
            })
            .node().value = data.dataref;

    } else if (process_type === "gel_separate") {

            addFieldAndLabel(form, "volume", "Volume:", "input")
            .on("change", function () {
                data.volume = this.value
            })
            .node().value = data.volume;

            addFieldAndLabel(form, "matrix", "Matrix:", "input")
            .on("change", function () {
                data.matrix = this.value
            })
            .node().value = data.matrix;

            addFieldAndLabel(form, "ladder", "Ladder:", "input")
            .on("change", function () {
                data.ladder = this.value
            })
            .node().value = data.ladder;

            addFieldAndLabel(form, "duration", "Duration:", "input")
            .on("change", function () {
                data.duration = this.value
            })
            .node().value = data.duration;

            addFieldAndLabel(form, "dataref", "Dataref:", "input")
            .on("change", function () {
                data.dataref = this.value
            })
            .node().value = data.dataref;

    }
    
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
    addContainerSelect(selected_node, links, restart, form, deleteNode, serialiseDiagram);

    // Form to set number of duplicates
    addFieldAndLabel(form, "duplicates", "Number of duplicates:", "input")
        .on("change", function () {
            selected_node.data.num_duplicates = this.value;
        })
        .node().value = selected_node.data.num_duplicates;


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

    var containerInput = addContainerSelect(selected_node, links, restart, form, deleteNode, serialiseDiagram);

    // If incident edge has 'addToThis' true, ensure container_name for this is consistent with this
    // and disable field to prevent it being changed
    for (var i = 0; i < links.length; i++) {
        if (links[i].target.id == selected_node.id && links[i].data.addToThis) {
            selected_node.data.container_name = networkEditor.getNodeContainer(links[i].source);
            containerInput.node().value = selected_node.data.container_name;
            containerInput.attr("disabled", "");
            break;
        }
    }

    // Form to set number of duplicates
    addFieldAndLabel(form, "duplicates", "Number of duplicates:", "input")
        .on("change", function () {
            selected_node.data.num_duplicates = this.value;
            getContents(serialiseDiagram, selected_node, contentsDiv);
        })
        .node().value = selected_node.data.num_duplicates;


    var contentsDiv = form.append("div").attr("id", "contents-div");
    getContents(serialiseDiagram, selected_node, contentsDiv);

    addDeleteButton(form, selected_node, deleteNode);
    // TODO: options menu to change type (alternative to context menu)
    // TODO: display of resulting aliquots


}
