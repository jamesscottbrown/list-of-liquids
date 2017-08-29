function validateOpenTrons() {

    var errorsFound = false;

    // first clear list
    var error_div = d3.select("#protocol-error-div");
    document.getElementById("protocol-error-div").innerHTML = "";


    // - resources must have a container assigned and a well
    var resources_errors = [];

    for (var i = 0; i < resources.length; i++) {
        if (!resources[i].data.container_name) {
            resources_errors.push(resources[i].label + " has no container set");
            d3.select("#resource-label-" + i).style("color", "#ffc200");
        }

        if (!resources[i].data.well_addresses) {
            resources_errors.push(resources[i].label + " is not assigned to specific wells");
            d3.select("#resource-label-" + i).style("color", "#ffc200");
        }
    }

    if (resources_errors) {
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
    }


    // - containers must have a locations
    var container_errors = [];
    for (var i = 0; i < containers.length; i++) {
        if (!containers[i].location) {
            container_errors.push(containers[i].name + " does not have a location set");
            d3.select("#container-label-" + i).style("color", "#ffc200");
        }
    }

    if (container_errors) {
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
        if (nodes[i].type != "well" && !nodes[i].data.container_name) {
            operation_errors.push("A operation of type " + nodes[i].type + " does not have a location set");
            d3.select("#label-" + nodes[i].id).style("fill", "#ffc200");
        }
    }

    if (operation_errors) {
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
    }


    // - edges must have a pipette assigned
    var link_errors = [];
    for (var i = 0; i < links.length; i++) {
        if (!links[i].data.pipette_name) {
            link_errors.push("An edge does not have a pipette associated");
            d3.select("#link-" + i).style("stroke", "#ffc200");
        }
    }

    if (link_errors) {
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


    // TODO: also check that well locations are assigned

    if (errorsFound) {
        $("#errorModal").modal('toggle');
    }

    return !errorsFound;
}