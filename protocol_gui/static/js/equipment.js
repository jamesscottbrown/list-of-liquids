var containers, pipettes;

function update_container_list() {
    var c = d3.select("#containers").select("ul").selectAll("li")
        .data(containers);

    c.enter().append("li");
    c.exit().remove();

    var container_node = d3.select("#containers").select("ul").selectAll("li").text(function (d) {
        return d.name + " (" + d.type + ") "
    });

    // Add delete buttons
    container_node.append("button")
        .append("i").classed("fa", true).classed("fa-trash-o", true).text(" Delete")
        .on("click", function (d) {
                containers.splice(containers.indexOf(d), 1);
                update_container_list();
                // TODO: update protocols that refer to this . . .
            }
        );

    // Add edit buttons
    container_node
        .append("button")
        .append("i").classed("fa", true).classed("fa-pencil-o", true).text(" Edit")
        .on("click", function (d, i) {

            $('#containerModal').modal('toggle');

            d3.select("#containerModal").select(".modal-title").text("Edit container");
            d3.select("#containerName").property('value', d.name);
            d3.select("#containerType").property('value', d.type);

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
                    type: d3.select("#containerType").node().value
                };
                $('#containerModal').modal('toggle');
                update_container_list();
            });
        });
}

function update_pipette_list() {
    var p = d3.select("#pipettes").select("ul").selectAll("li")
        .data(pipettes);

    p.enter().append("li");
    p.exit().remove();

    var pippette_nodes = d3.select("#pipettes").select("ul").selectAll("li")
        .text(function (d) {
            return d.name + " (" + d.volume + " µl) "
        });

    // Add delete buttons
    pippette_nodes
        .append("button")
        .append("i").classed("fa", true).classed("fa-trash-o", true).text(" Delete")
        .on("click", function (d) {
                pipettes.splice(pipettes.indexOf(d), 1);
                update_pipette_list();
                // TODO: update protocols that refer to this . . .
            }
        );

    // Add edit buttons
    pippette_nodes
        .append("button")
        .append("i").classed("fa", true).classed("fa-pencil-o", true).text(" Edit")
        .on("click", function (d, i) {

            $('#pipetteModal').modal('toggle');

            d3.select("#pipetteModal").select(".modal-title").text("Edit pipette");
            d3.select("#pipetteName").property('value', d.name);
            d3.select("#pipetteVolume").property('value', d.volume);

            d3.select("#AddPipetteButton").on("click", function () {
                pipettes[i] = {
                    name: d3.select("#pipetteName").node().value,
                    volume: d3.select("#pipetteVolume").node().value
                };
                $('#pipetteModal').modal('toggle');
                update_pipette_list();
            });
        });

}


d3.select("#add-pipette").on("click", function () {
    $('#pipetteModal').modal('toggle');
    d3.select("#pipetteModal").select(".modal-title").text("Add pipette");

    d3.select("#AddPipetteButton").on("click", function () {
        pipettes.push({
            name: d3.select("#pipetteName").node().value,
            volume: d3.select("#pipetteVolume").node().value
        });
        $('#pipetteModal').modal('toggle');
        update_pipette_list();
    });
});


d3.select("#add-container").on("click", function () {
    $('#containerModal').modal('toggle');
    d3.select("#containerModal").select(".modal-title").text("Add container");


    d3.select("#AddContainerButton").on("click", function () {
        containers.push({
            name: d3.select("#containerName").node().value,
            type: d3.select("#containerType").node().value
        });
        $('#containerModal').modal('toggle');
        update_container_list();
    });
});


