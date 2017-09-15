function validateOpenTrons() {
    var errorsFound = false;

    // first clear list
    var error_div = d3.select("#protocol-error-div");
    document.getElementById("protocol-error-div").innerHTML = "";

    // AJAX request to find aliquots with no assigned wells
    var unassigned_wells;
    var protocol_string = serialiseDiagram();
    $.ajax({
        type: "GET",
        contentType: "application/json; charset=utf-8",
        url: window.location.href + "checkWellsAssigned",
        dataType: 'json',
        async: false, // this is not an asynchronous request
        data: {protocol_string: protocol_string},
        beforeSend: function (xhr) {
            xhr.setRequestHeader("X-CSRFToken", csrf_token);
        },
        success: function (res) {
            unassigned_wells = res;
            console.log(res);
        },
        error: function (result, textStatus) {
            console.log(result);
            console.log(textStatus);
            errorsFound = true;
        }
    });
    if (errorsFound) {
        return false;
    }

    // validate pipettes
    var pipette_errors = [];
    for (var i = 0; i < pipettes.length; i++) {
        if (!pipettes[i].tipracks ) {
            pipette_errors.push(pipettes[i].name + " has no tip rack set");
        }
        if (!pipettes[i].trash ) {
            pipette_errors.push(pipettes[i].name + " has no trash container set");
        }
    }

     if (pipette_errors.length > 0) {
        errorsFound = true;

        error_div.append("h3").text("Problems with pipettes");

        error_div.append("ul")
            .selectAll("li")
            .data(pipette_errors)
            .enter()
            .append("li")
            .text(function (d) {
                return d;
            });
    }




    // - resources must have a container assigned and a well
    var resources_errors = [];

    for (var i = 0; i < resources.length; i++) {
        if (!resources[i].data.container_name) {
            resources_errors.push(resources[i].label + " has no container set");
            d3.select("#resource-label-" + i).style("fill", "#ffc200");
        }
    }

    d3.selectAll(".node-label")
        .filter(function (d) {
            return unassigned_wells.unassigned_resources.indexOf(d.id) != -1;
        })
        .style("fill", "#ffc200");


    if (resources_errors.length > 0 || unassigned_wells.unassigned_resources.length >0) {
        errorsFound = true;

        error_div.append("h3").text("Problems with resources");

        error_div.append("ul")
            .selectAll("li")
            .data(resources_errors)
            .enter()
            .append("li")
            .text(function (d) {
                return d;
            });

        if (unassigned_wells.unassigned_resources.length > 0) {
            error_div.append("p")
                .text(function (d) {
                    return "Some resources have a container assigned, but no well assigned";
                });
        }
    }


    // - containers must have a locations
    var container_errors = [];
    for (var i = 0; i < containers.length; i++) {
        if (!containers[i].location) {
            container_errors.push(containers[i].name + " does not have a location set");
            d3.select("#container-label-" + i).style("color", "#ffc200");
        }
    }

    if (container_errors.length > 0) {
        errorsFound = true;

        error_div.append("h3").text("Problems with containers");

        error_div.append("ul")
            .selectAll("li")
            .data(container_errors)
            .enter()
            .append("li")
            .text(function (d) {
                return d;
            });
    }

    // - operations must have a container assigned
    var operation_errors = [];
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].type != "resource" && nodes[i].type != "process" && !nodes[i].data.container_name) {
            operation_errors.push("A operation of type " + nodes[i].type + " does not have a location set");
            d3.select("#label-" + nodes[i].id).style("fill", "#ffc200");
        }
    }

       d3.selectAll(".node-label")
        .filter(function (d) {
            return unassigned_wells.unassigned_operations.indexOf(d.id) != -1;
        })
        .style("fill", "#ffc200");


    if (operation_errors.length > 0 || unassigned_wells.unassigned_operations.length > 0) {
        errorsFound = true;

        error_div.append("h3").text("Problems with operations");

        error_div.append("ul")
            .selectAll("li")
            .data(operation_errors)
            .enter()
            .append("li")
            .text(function (d) {
                return d;
            });

        error_div.append("p")
            .text(function (d) {
                return "Some operations have a container assigned, but not all wells assigned";
            });
    }


    // - edges must have a pipette assigned
    var link_errors = [];
    for (var i = 0; i < links.length; i++) {
        if (!links[i].data.pipette_name && links[i].target.type != "process" && !links[i].data.addToThis) {
            link_errors.push("An edge does not have a pipette associated");
            d3.select("#link-" + i).style("stroke", "#ffc200");
        }
    }

    if (link_errors.length > 0) {
        errorsFound = true;

        error_div.append("h3").text("Problems with liquid transfers");

        error_div.append("ul")
            .selectAll("li")
            .data(link_errors)
            .enter()
            .append("li")
            .text(function (d) {
                return d;
            });
    }


    if (errorsFound) {
        $("#errorModal").modal('toggle');
    }

    return !errorsFound;
}