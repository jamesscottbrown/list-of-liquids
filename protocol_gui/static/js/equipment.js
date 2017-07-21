var containers, pipettes;

function update_container_list() {
    d3.select("#containers").selectAll("li").remove();

    var c = d3.select("#containers").select("ul").selectAll("li")
        .data(containers);

    c.enter().append("li");
    c.exit().remove();

    var container_node = d3.select("#containers").select("ul").selectAll("li");

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

            d3.select("#DeleteContainerButton").on("click", function(d){
                containers.splice(containers.indexOf(d), 1);
                update_container_list();
                $('#containerModal').modal('toggle');
            })

        })
        .append("span").classed("fa", true).classed("fa-pencil", true);

            container_node.append("a")
            .text("Show or Set well locations")
            .on("click", function (container) {
                // need to make sure populationWellAssignmentModal isn't called until modal is shown
                // as we scale SVG to fit inside it
                $('#locationModal').one('shown.bs.modal', function(){populationWellAssignmentModal(container.name, serialiseDiagram)});
                $('#locationModal').modal('toggle');
            });


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

    d3.select("#DeletePipetteButton").on("click", function (d) {
        pipettes.splice(pipettes.indexOf(d), 1);
        update_pipette_list();
        $('#pipetteModal').modal('toggle');
    });

    pippette_nodes.selectAll("b").style('color', function (d) {
        console.log(d)
        return color(pipettes.indexOf(d));
    });

}

function addPipette(updateDescriptionPanelCallback) {
    $('#pipetteModal').modal('toggle');
    d3.select("#pipetteModal").select(".modal-title").text("Add pipette");

    d3.select("#AddPipetteButton").on("click", function () {
        pipettes.push({
            name: d3.select("#pipetteName").node().value,
            volume: d3.select("#pipetteVolume").node().value,
            min_volume: d3.select("#pipetteMinVolume").node().value,
            axis: d3.select("#pipetteAxis").node().value,
            tipracks: d3.select("#pipetteTipRacks").node().value,
            channels: d3.select("#pipetteChannels").node().value,
            aspirateSpeed: d3.select("#pipetteAspirateSpeed").node().value,
            dispenseSpeed: d3.select("#pipetteDispenseSpeed").node().value
        });
        $('#pipetteModal').modal('toggle');
        update_pipette_list();

        if (updateDescriptionPanelCallback){
            updateDescriptionPanelCallback();
        }
    });
}

function addContainer(updateDescriptionPanelCallback) {
    $('#containerModal').modal('toggle');
    d3.select("#containerModal").select(".modal-title").text("Add container");


    d3.select("#AddContainerButton").on("click", function () {
        containers.push({
            name: d3.select("#containerName").node().value,
            type: d3.select("#containerType").node().value,
            location: d3.select("#containerLocation").node().value,
            contents: {}
        });
        $('#containerModal').modal('toggle');
        update_container_list();

        if (updateDescriptionPanelCallback){
            updateDescriptionPanelCallback();
        }
    });
}

d3.select("#add-pipette").on("click", addPipette);
d3.select("#add-container").on("click", addContainer);


