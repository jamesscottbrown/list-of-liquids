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
        filter(lambda x: (x["type"] == "well" and x["data"]["resource"] == resource["label"]), protocol["nodes"])[0]

        for location in container["contents"]:
            for contents in container["contents"][location]:
                if int(contents["operation_index"]) == int(node["id"]):
                    locations.append(location)

        return ", ".join(locations)

    def process_node(self, node, protocol):

        protocol_str = ""

        num_duplicates = int(node["data"]["num_duplicates"])
        parent_nodes = filter(lambda x: x["id"] in node["parentIds"], protocol["nodes"])

        for i in range(0, len(parent_nodes)):

            if parent_nodes[i]["type"] == "well":
                resources = protocol["resources"]
                resource = list(filter(lambda r: r["label"] == parent_nodes[i]["data"]["resource"], resources))[0]
                parent_nodes[i] = resource

        # skip operation if from somewhere to same place
        link_one_data = filter(lambda x: x["source_id"] == node["parentIds"][0] and x["target_id"] == node["id"],
                               protocol["links"])[0]["data"]
        volume_one = link_one_data["volumes"][0]
        container_one = parent_nodes[0]["data"]["container_name"]
        locations_one = self.get_locations(protocol, parent_nodes[0])

        if len(parent_nodes) > 1:
            link_two_data = filter(lambda x: x["source_id"] == node["parentIds"][1] and x["target_id"] == node["id"],
                                   protocol["links"])[0]["data"]
            volume_two = link_two_data["volumes"][0]
            container_two = parent_nodes[0]["data"]["container_name"]
            locations_two = self.get_locations(protocol, parent_nodes[1])

        container_target = node["data"]["container_name"]
        locations_result = self.get_locations(protocol, node)

        if node["type"] == "zip":

            well_index = 0
            for repeat_number in range(0, num_duplicates):

                for i in range(0, len(locations_one)):
                    target_well = locations_result[well_index]

                    source_well = locations_one[i]
                    if source_well != target_well:
                        protocol_str += "* Transfer %s from %s/%s to %s/%s using %s \n" % \
                                        (volume_one, container_one, source_well, container_target, target_well,
                                         link_one_data["pipette_name"])

                    source_well = locations_two[i]
                    if source_well != target_well:
                        protocol_str += "* Transfer %s from %s/%s to %s/%s using %s \n" % \
                                        (volume_two, container_two, source_well, container_target, target_well,
                                         link_two_data["pipette_name"])

                    well_index += 1

            print "\n\n"

        elif node["type"] == "cross":

            i = 0
            for repeat_number in range(0, num_duplicates):

                for a in locations_one:
                    for b in locations_two:

                        target_well = locations_result[i]
                        if a != target_well:
                            protocol_str += "* Transfer %s from %s/%s to %s/%s using %s \n" % \
                                            (volume_one, container_one, a, container_target, target_well,
                                             link_one_data["pipette_name"])

                        if b != target_well:
                            protocol_str += "* Transfer %s from %s/%s to %s/%s using %s \n" % \
                                            (volume_two, container_two, b, container_target, target_well,
                                             link_one_data["pipette_name"])

                        i += 1
            print "\n\n"


            #  "process", "pool", "aliquot", "select"
        return protocol_str
