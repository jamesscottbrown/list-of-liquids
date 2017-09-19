var containers, pipettes, resources;

function update_container_list() {
    d3.select("#containers").selectAll("li").remove();

    var c = d3.select("#containers").select("ul").selectAll("li")
        .data(containers);

    c.enter().append("li");
    c.exit().remove();

    var container_node = d3.select("#containers").select("ul").selectAll("li");

    container_node.attr("id", function(d,i){ return "container-label-" + i; });

    container_node.append("b")
        .text(function (d) {
            return d.name + " (" + d.type + ") "
        });

    // Add edit buttons
    container_node
        .append("button")
        .attr("class", "btn btn-default")
        .text(" Edit ")
        .on("click", function (d, i) {

            $('#containerModal').modal('toggle');

            d3.select("#containerModal").select(".modal-title").text("Edit container");
            d3.select("#containerName").property('value', d.name);
            d3.select("#containerType").property('value', d.type);
            d3.select("#containerLocation").property('value', d.location);

            d3.select("#AddContainerButton").on("click", function () {

                var oldName = d.name;
                var newName = d3.select("#containerName").node().value;

                // adjust any nodes to match the new container name
                for (var j = 0; j < nodes.length; j++) {
                    if (nodes[j].data.container_name == oldName) {
                        nodes[j].data.container_name = newName;
                    }
                }

                // adjust any resources to match the new container name
                for (var j = 0; j < resources.length; j++) {
                    if (resources[j].data.container_name == oldName) {
                        resources[j].data.container_name = newName;
                    }
                }

                // adjust any pipettes
                for (var j = 0; j < pipettes.length; j++) {
                    if (pipettes[j].tripracks == oldName) {
                        pipettes[j].tripracks = newName;
                    }
                    if (pipettes[j].trash == oldName) {
                        pipettes[j].trash = newName;
                    }
                }

                containers[i] = {
                    name: newName,
                    type: d3.select("#containerType").node().value,
                    location: d3.select("#containerLocation").node().value,
                    contents: d.contents
                };
                $('#containerModal').modal('toggle');
                update_container_list();
                updateDescriptionPanel();
            });

            d3.select("#DeleteContainerButton").on("click", function () {

                // ensure container is not listed as tip rack or trash container for any pipettes after being deleted
                for (var i=0; i<pipettes.length; i++){
                    if (pipettes[i].tipracks == d.name){
                        pipettes[i].tipracks = "";
                    }
                    if (pipettes[i].trash == d.name){
                        pipettes[i].trash = "";
                    }
                }

                containers.splice(containers.indexOf(d), 1);
                update_container_list();
                $('#containerModal').modal('toggle');

                // immediately re-color nodes that now have no container set
                networkEditor.restart();
            })

        })
        .append("span").classed("fa", true).classed("fa-pencil", true);

    container_node.append("button")
        .attr("class", "btn btn-default")
        .text("Well locations ")
        .on("click", function (container) {
            // need to make sure populationWellAssignmentModal isn't called until modal is shown
            // as we scale SVG to fit inside it
            $('#locationModal').one('shown.bs.modal', function () {
                populationWellAssignmentModal(container.name, serialiseDiagram)
            });
            $('#locationModal').modal('toggle');
        })
    .append("i").attr("class", "fa fa-table");


    container_node.selectAll("b").style('color', function (d) {
        return color(containers.indexOf(d));
    })

}

function update_pipette_list() {
    d3.select("#pipettes").selectAll("li").remove();

    var p = d3.select("#pipettes").select("ul").selectAll("li")
        .data(pipettes);

    p.enter().append("li");
    p.exit().remove();

    var pippette_nodes = d3.select("#pipettes").select("ul").selectAll("li");

    pippette_nodes
        .append("b")
        .text(function (d) {
            return d.name + " (" + d.volume + " µl) "
        });

    // Add edit buttons
    pippette_nodes
        .append("button")
        .text(" Edit ")
        .attr("class", "btn btn-default")
        .on("click", function (d, i) {

            $('#pipetteModal').modal('toggle');

            d3.select("#pipetteModal").select(".modal-title").text("Edit pipette");
            d3.select("#pipetteName").property('value', d.name);
            d3.select("#pipetteVolume").property('value', d.volume);

            d3.select("#pipetteTipRacks")
                .selectAll("option")
                .data(containers.filter(function (d) {
                    return d.type.startsWith("tiprack");
                }))
                .enter()
                .append("option")
                .text(function (d) { return d.name; })
                .attr("value", function (d) { return d.name; });

            d3.select("#pipetteTrash")
                .selectAll("option")
                .data(containers.filter(function (d) {
                    return d.type.startsWith("trash");
                }))
                .enter()
                .append("option")
                .text(function (d) { return d.name; })
                .attr("value", function (d) { return d.name; });


            d3.select("#AddPipetteButton").on("click", function () {

                var oldName = d.name;
                var newName = d3.select("#pipetteName").node().value;

                // adjust any links to match the new pipette name
                for (var j = 0; j < links.length; j++) {
                    if (links[j].data.pipette_name == oldName) {
                        links[j].data.pipette_name = newName;
                    }
                }

                pipettes[i] = {
                    name: newName,
                    volume: d3.select("#pipetteVolume").node().value,
                    min_volume: d3.select("#pipetteMinVolume").node().value,
                    axis: d3.select("#pipetteAxis").node().value,
                    tipracks: d3.select("#pipetteTipRacks").node().value,
                    trash:  d3.select("#pipetteTrash").node().value,
                    channels: d3.select("#pipetteChannels").node().value,
                    aspirateSpeed: d3.select("#pipetteAspirateSpeed").node().value,
                    dispenseSpeed: d3.select("#pipetteDispenseSpeed").node().value
                };
                $('#pipetteModal').modal('toggle');
                update_pipette_list();
                updateDescriptionPanel();

            });
        })
        .append("span").classed("fa", true).classed("fa-pencil", true);

        pippette_nodes
        .append("button")
        .text(" Assign remaining transfers to this pipette ")
        .attr("class", "btn btn-default")
        .on("click", function (d) {

            for (var j=0; j<links.length; j++){
                if (!links[j].data.pipette_name && !links[j].data.addToThis){
                    links[j].data.pipette_name = d.name;
                }
            }

           networkEditor.restart();
        });

    d3.select("#DeletePipetteButton").on("click", function (d) {
        pipettes.splice(pipettes.indexOf(d), 1);
        update_pipette_list();
        $('#pipetteModal').modal('toggle');

        // immediately re-color edges that now have no pipette associated
        networkEditor.restart();
    });

    pippette_nodes.selectAll("b").style('color', function (d) {
        return color(pipettes.indexOf(d));
    });

}


function update_resource_list() {
    d3.select("#resources").selectAll("li").remove();

    var p = d3.select("#resources").select("ul").selectAll("li")
        .data(resources);

    p.enter().append("li");
    p.exit().remove();

    var resource_nodes = d3.select("#resources").select("ul").selectAll("li");

    var label = resource_nodes
        .append("span")
        .attr("id", function(d,i){ return "resource-label-" + i; })
        .classed("resource-label", true);

    label.append("span").attr("class", "fa fa-flask");

    label.append("b")
        .text(function (d) {
            return d.label;
        });

    label.attr("draggable", true)
        .on("dragstart", function (d) {
            var ev = d3.event;
            ev.dataTransfer.setData("custom-data", d.label);
        })
        .on("drop", function () {
        });

    resource_nodes.append("button")
        .on("click", function (d) {
            // Delete resource
            resources.splice(resources.indexOf(d), 1);
            update_resource_list();

            // Delete nodes from diagram
            var nodesToDelete = nodes.filter(function(n){return n.type == "resource" && n.label == d.label});
            for (var i=0; i<nodesToDelete.length; i++){
                networkEditor.deleteNode(nodesToDelete[i]);
            }
        })
        .text("Delete ").append("i").classed("fa", true).classed("fa-trash-o", true);

}


function addPipette(updateDescriptionPanelCallback) {
    $('#pipetteModal').modal('toggle');
    d3.select("#pipetteModal").select(".modal-title").text("Add pipette");
    d3.select("#pipetteName-help").text("");

    document.getElementById("pipetteName").value = "";

    d3.select("#pipetteTipRacks")
        .selectAll("option")
        .data(containers.filter(function(d){ return d.type.startsWith("tiprack"); }))
        .enter()
        .append("option")
        .text(function (d){ return d.name; })
        .attr("value", function (d) { return d.name; });

    d3.select("#pipetteTrash")
        .selectAll("option")
        .data(containers.filter(function (d) {
            return d.type.startsWith("trash");
        }))
        .enter()
        .append("option")
        .text(function (d) { return d.name; })
        .attr("value", function (d) { return d.name; });

    d3.select("#AddPipetteButton").on("click", function () {
        var pipetteName = d3.select("#pipetteName").node().value;
        if (!pipetteName || pipettes.filter( function(d){ return d.name == pipetteName}).length > 0 ){
            d3.select("#pipetteName-help").text("Pipette name must be non-empty and unique.");
            return false;
        }

        pipettes.push({
            name: pipetteName,
            volume: d3.select("#pipetteVolume").node().value,
            min_volume: d3.select("#pipetteMinVolume").node().value,
            axis: d3.select("#pipetteAxis").node().value,
            tipracks: d3.select("#pipetteTipRacks").node().value,
            trash:  d3.select("#pipetteTrash").node().value,
            channels: d3.select("#pipetteChannels").node().value,
            aspirateSpeed: d3.select("#pipetteAspirateSpeed").node().value,
            dispenseSpeed: d3.select("#pipetteDispenseSpeed").node().value
        });
        $('#pipetteModal').modal('toggle');
        update_pipette_list();

        if (updateDescriptionPanelCallback) {
            updateDescriptionPanelCallback();
        }
    });
}

function addContainer(updateDescriptionPanelCallback) {
    $('#containerModal').modal('toggle');
    d3.select("#containerModal").select(".modal-title").text("Add container");
    d3.select("#containerName-help").text("");

    document.getElementById("containerName").value = "";
    document.getElementById("containerLocation").value = "";

    d3.select("#AddContainerButton").on("click", function () {

        var containerName = d3.select("#containerName").node().value;
        if (!containerName || containers.filter( function(d){ return d.name == containerName}).length > 0 ){
            d3.select("#containerName-help").text("Container name must be non-empty and unique.");
            return false;
        }

        containers.push({
            name: containerName,
            type: d3.select("#containerType").node().value,
            location: d3.select("#containerLocation").node().value,
            contents: {}
        });
        $('#containerModal').modal('toggle');
        update_container_list();

        if (updateDescriptionPanelCallback) {
            updateDescriptionPanelCallback();
        }
    });
}

d3.select("#add-pipette").on("click", addPipette);
d3.select("#add-container").on("click", addContainer);


