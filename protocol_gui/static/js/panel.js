function updateDescriptionPanel(selected_node, selected_link, links,  restart, redrawLinkLabels) {

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

    if (selected_node && selected_node.type == "well") {
        drawWellPanel(selected_node, restart, form);
    } else if (selected_link) {
        drawTransferPanel(selected_node, selected_link, links,  restart, redrawLinkLabels, form);
    } else if (selected_node && selected_node.type == "process") {
        drawProcessPanel(selected_node, restart, form);
    } else if (selected_node){
        drawOperationPanel(selected_node, selected_link, links,  restart, redrawLinkLabels, form);
    }
}


function drawWellPanel(selected_node, restart, form) {
    form.append("h2").style().text("Initially present resource");

    var div1 = form.append("div").classed("form-group", true);
    div1.append("label")
        .classed("control-label", true)
        .classed("col-sm-2", true)
        .attr("for", "name")
        .text("Name:");

    div1.append("div")
        .classed("col-sm-2", true)
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
        .classed("col-sm-2", true)
        .attr("for", "num-wells")
        .text("Number of wells:");

    div2.append("div")
        .classed("col-sm-2", true)

        .append("input")
        .attr("type", "text")
        .attr("id", "num-wells")
        .attr("name", "num-wells")
        .classed("form-control", true)
        .attr("value", selected_node.data.num_wells)
        .on("change", function () {
            selected_node.data.num_wells = this.value;
        });


    var div3 = form.append("div").classed("form-group", true);
    div3.append("label")
        .classed("control-label", true)
        .classed("col-sm-2", true)
        .attr("for", "container-name")
        .text("Container name:");

    div3.append("div")
        .classed("col-sm-2", true)
        .append("input")
        .attr("type", "text")
        .attr("id", "container-name")
        .attr("name", "container-name")
        .classed("form-control", true)
        .attr("value", selected_node.data.container_name)
        .on("change", function () {
            selected_node.data.container_name = this.value;
        });


    var div4 = form.append("div").classed("form-group", true);
    div4.append("label")
        .classed("control-label", true)
        .classed("col-sm-2", true)
        .attr("for", "wells")
        .text("Well locations:");

    div4.append("div")
        .classed("col-sm-2", true)
        .append("input")
        .attr("type", "text")
        .attr("id", "wells")
        .attr("name", "wells")
        .classed("form-control", true)
        .attr("value", selected_node.data.well_addresses)
        .on("change", function () {
            selected_node.data.well_addresses = this.value;
        });
}


function drawTransferPanel(selected_node, selected_link, links,  restart, redrawLinkLabels, form){

    var title;
    if (selected_link.source.type == "well"){
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
        .classed("col-sm-2", true)
        .attr("for", "container")
        .text("Add to this container");

    var containerSelect = containerDiv.append("select")
        .classed("control-input", true)
        .classed("col-sm-2", true)
        .attr("name", "container")
        .attr("id", "container")
        .on("change", function(d){

            // ensure that no more than one link incident to the same node has addToThis true
            if (this.value == "Yes"){
                links.filter(function(x){ return x.target.id == selected_link.target.id })
                      .map(function(x){x.data.addToThis = false});
            }

            selected_link.data.addToThis = (this.value == "Yes");
            restart();
        });

    containerSelect.append("option").text("Yes");
    containerSelect.append("option").text("No");
    containerSelect.node().value = (selected_link.data.addToThis ? "Yes" : "No");


    // Form to set whether we are changing tips
    var changeTipDiv = form.append("div").append("div")
        .classed("form-group", true);

    changeTipDiv.append("label")
        .classed("control-label", true)
        .classed("col-sm-2", true)
        .attr("for", "change-tips")
        .text("Change Tips");

    var changeTipSelect = changeTipDiv.append("select")
        .classed("control-input", true)
        .classed("col-sm-2", true)
        .attr("name", "change-tips")
        .attr("id", "change-tips")
        .on("change", function(d){
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
        .classed("col-sm-2", true)
        .attr("for", "change-tips")
        .text("Mix");

    var mixSelect = mixDiv.append("select")
        .classed("control-input", true)
        .classed("col-sm-2", true)
        .attr("name", "change-tips")
        .attr("id", "change-tips")
        .on("change", function(d){
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
        .classed("col-sm-2", true)
        .attr("for", "volume");

    label.append("i").classed("fa", true).classed("fa-minus", true)
        .on("click", function (d, i) {
            volumes.splice(i, 1);
            updateDescriptionPanel(selected_node, selected_link, links, restart, redrawLinkLabels);
            redrawLinkLabels();
        });
    label.append("b").text(function (d, i) {
        return "Volume " + (i + 1) + ":";
    });

    volumeDivs.append("input")
        .classed("control-input", true)
        .classed("col-sm-2", true)
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

    // adding an extra volume
    div2.append("div")
        .classed("form-group", true)
        .append("label")
        .classed("control-label", true)
        .classed("col-sm-2", true)
        .append("i").classed("fa", true).classed("fa-plus", true)
        .on("click", function () {
            volumes.push(0);
            updateDescriptionPanel(selected_node, selected_link, links, restart, redrawLinkLabels);
            redrawLinkLabels();
        });
}

function drawProcessPanel(selected_node, restart, form){
    form.append("h2").style().text("Processing step");

    var div1 = form.append("div").classed("form-group", true);
    div1.append("label")
        .classed("control-label", true)
        .classed("col-sm-2", true)
        .attr("for", "name")
        .text("Name:");

    div1.append("div")
        .classed("col-sm-2", true)

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
        .classed("col-sm-2", true)
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
}

function drawOperationPanel(selected_node, selected_link, links,  restart, redrawLinkLabels, form){
    form.append("h2").style().text("Operation");

    // TODO: options menu to change type (alternative to context menu)
    // TODO: display of resulting aliquots

}