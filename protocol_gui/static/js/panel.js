function updateDescriptionPanel(selected_node, restart) {

    // TODO: rather than calling restart(), redraw single label
    var info = d3.select("#info");
    info.select("form").remove();

    if (!selected_node) {
        return;
    }

    var form = info.append("form")
        .classed("form-horizontal", true)
        .classed("info-box", true)
        .attr("onsubmit", "return false;");

    var div1, div2;

    if (selected_node.type == "well") {

        div1 = form.append("div").classed("form-group", true);
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

        div2 = form.append("div").classed("form-group", true);
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



    } else if (selected_node.type == "volume") {
        div1 = form.append("div").classed("form-group", true);

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


        div2 = form.append("div");

        var volumeDivs = div2.selectAll("div")
            .data(selected_node.data)
            .enter()
            .append("div")
            .classed("form-group", true);

        var label = volumeDivs.append("label")
            .classed("control-label", true)
            .classed("col-sm-2", true)
            .attr("for", "volume");

        label.append("i").classed("fa", true).classed("fa-minus", true)
            .on("click", function (d, i) {
                selected_node.data.splice(i, 1);
                updateDescriptionPanel(selected_node, restart);
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
                var volumes = [];
                var volumeInputs = volumeDivs.selectAll("input");
                for (var i = 0; i < volumeInputs.length; i++) {
                    volumes.push(parseFloat(volumeInputs[i][0].value))
                }
                selected_node.data = volumes;
            });

        // adding an extra volume
        div2.append("div")
            .classed("form-group", true)
            .append("label")
            .classed("control-label", true)
            .classed("col-sm-2", true)
            .append("i").classed("fa", true).classed("fa-plus", true)
            .on("click", function () {
                selected_node.data.push(0);
                updateDescriptionPanel(selected_node, restart);
            });


    } else if (selected_node.type == "process") {
        div1 = form.append("div").classed("form-group", true);
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

        div2 = form.append("div").classed("form-group", true);
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

    } else if (selected_node.type == "aliquot") {

        // Container
        var div1 = form.append("div").classed("form-group", true);
        div1.append("label")
            .classed("control-label", true)
            .classed("col-sm-2", true)
            .attr("for", "container-name")
            .text("Container name:");

        div1.append("div")
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



        // Contents
    }
}
