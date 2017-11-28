from protocol_gui.protocol.converter import Converter


class English(Converter):
    def get_header(self, protocol, name, protocol_description):

        protocol_str = "# %s\n" % name

        protocol_str += "This protocol was exported from List of Liquids\n"
        protocol_str += " " + protocol_description + "\n\n"

        protocol_str += "## Containers\n"
        for container in protocol["containers"]:
            protocol_str += "* %s (%s, %s)\n" % (container["name"], container["type"], container["location"])
        protocol_str += "\n"

        if protocol["pipettes"]:
            protocol_str += "## Pipettes\n"

            for pipette in protocol["pipettes"]:
                protocol_str += '* %s (min_volume="%s", max_volume="%s")\n' % (
                    pipette["name"], pipette["min_volume"], pipette["volume"])

            protocol_str += "\n"

        protocol_str += "## Initially present resources\n"
        for resource in protocol["resources"]:
            protocol_str += "* %s (%s wells in %s, at [%s]) \n" % (
                resource["label"], resource["data"]["num_wells"], resource["data"]["container_name"],
                self.get_resource_locations(protocol, resource))

        protocol_str += "\n"

        protocol_str += "## Operations\n"

        return protocol_str

    def get_resource_locations(self, protocol, resource):
        locations = []

        container = filter(lambda x: x["name"] == resource["data"]["container_name"], protocol["containers"])[0]

        node = \
        filter(lambda x: (x["type"] == "resource" and x["data"]["resource"] == resource["label"]), protocol["nodes"])[0]

        for location in container["contents"]:
            for contents in container["contents"][location]:
                if int(contents["node_id"]) == int(node["id"]):
                    locations.append(location)

        return ", ".join(locations)

    def get_transfer_string(self, pipette_name, volume, container, source_row, container_target, result_row, options_str, target_container_cols):
        return "* Transfer %s from row %s of %s to row %s of %s using %s \n" % \
               (volume, source_row, container, result_row, container_target, pipette_name)

    def get_transfer_well_string(self, pipette_name, volume, container, source_well, container_target, result_well, options_str):
        return "* Transfer %s from well %s of %s to well %s of %s using %s \n" % \
               (volume, source_well, container, result_well, container_target, pipette_name)

    def get_distribute_string(self, pipette_name, volume, container, source, container_target, targets_str, options_str):
        return "* Distribute %s from well %s of %s to %s of %s using %s \n" % \
               (volume, source, container, targets_str, container_target, pipette_name)

    def get_consolidate_string(self, pipette_name, volume, container_one, source_str, container_target, target, options_str):
        return "* Consolidate/pool %s from %s of %s to %s of %s\n" % (volume, source_str, container_one, target, container_target)

    def get_process_string(self, node_data, options, well_locations):
        operation_type = node_data["process_type"]
        container = node_data["container_name"]

        wells = "%s.wells(%s)" % (container, well_locations)

        if operation_type == "spin":
            return "* Spin container %s at a speed of %s for %s\n" % (container, options["acceleration"], options["duration"])

        elif operation_type == "cover":
            return "* Cover container %s with a lid of type '%s'\n" % (container, options["lid_type"])

        elif operation_type == "seal":
            return "* Seal container %s\n" % (container)

        elif operation_type == "unseal":
            return "* Un-seal container %s\n" % (container)

        elif operation_type == "incubate":
            return "* Incubate container %s at a temeprature of %s for %s \n" % (container, options["where"], options["duration"])

        elif operation_type == "thermocycle":
            return "* Thermocycle container %s (%s), using volume %s\n" % (container, options["schedule"], options["volume"])

        elif operation_type == "absorbance":
            return "* Measure absorbance of wells %s from container %s at wavelength %s using %s flashes, recording the result as %s \n" % \
                   (wells, container, options["wavelength"], options["num_flashes"] , options["dataref"])

        elif operation_type == "luminescence":
            return "* Measure luminescence of wells %s from container %s, recording result as %s \n" % \
                   (wells, container, options["dataref"])

        elif operation_type == "gel_separate":
            return "* Perform gel-separation of %s of sample taken from wells %s of container %s (matrix %s, ladder %s, duration %s), recording results as %s \n" % \
                   (options["volume"], wells, options["matrix"], options["ladder"], options["duration"], options["dataref"])

        elif operation_type == "fluorescence":
            return "* Measure absorbance of wells %s from container %s at wavelength %s when stimulated using %s flashes at %s, with terature %s, recording the result as %s \n" % \
                   (options["wells"], container, options["emission"], options["num_flashes"],  options["excitation"], options["temperature"], options["dataref"])

        else:
            return "    * **FIXME: operation '" + operation_type + "' not implemented for English-language protocol export** \n"

    def get_pick_string(self, container, source_wells, container_target, target_wells, min_colonies):
        return "* Autopick a minimum of %s colonies from well %s of %s to wells %s of %s \n" % (min_colonies, source_wells, container, target_wells, container_target)

    def get_spread_string(self, container, source_wells, container_target, target_wells, volume):
        return "* Spread %s from well %s of %s to wells %s of %s \n" % (volume, source_wells, container, target_wells, container_target)

