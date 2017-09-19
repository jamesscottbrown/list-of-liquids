from protocol_gui.protocol.converter import Converter


class English(Converter):
    def get_header(self, protocol, name):

        protocol_str = "# %s\n" % name

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

    def get_transfer_string(self, pipette_name, volume, container, source_row, container_target, result_row, options_str):
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

    def get_process_string(self, command):
        return "* Perform operation ``%s``\n" % command