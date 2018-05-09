import json
import os

class Converter:
    def __init__(self):
        self.protocol = ""
        pass

    def convert(self, protocol, protocol_name, protocol_description):
        self.protocol = protocol
        protocol_str = self.get_header(protocol, protocol_name, protocol_description)

        # do a topological sort on the operations graph, and process nodes in a consistent order
        operation_nodes = filter(lambda x: x["type"] in ["zip", "cross", "pool", "aliquot", "select", "pick", "spread"], protocol["nodes"])
        processed_nodes = filter(lambda x: x["type"] == "resource", protocol["nodes"])

        # handle process nodes separately
        if "operations" in protocol.keys():
            for operation in protocol["operations"]:
                parents = set()

                # aggregate parents across all nodes instantiating this process
                for leaf in operation["leaves"]:
                    node = filter(lambda x: x["id"] == leaf["id"], protocol["nodes"])[0]
                    parents = parents.union(node["parentIds"])

                operation_nodes.append({"parentIds": list(parents), "id": node["id"], "data": node["data"],
                                        "type": "process", "operation": operation})

                print "Added operation", {"parentIds": list(parents), "id": node["id"], "data": node["data"]}


        while len(operation_nodes) > 0:
            for node in operation_nodes:

                can_process_node = True
                parent_ids = node["parentIds"]
                for pid in parent_ids:

                    # if parent has not been processed, cannot process node yet
                    if not filter(lambda x: x["id"] == pid, processed_nodes):
                        can_process_node = False

                    # if edge is 'addToThis', we must do any other operations involving the parent first
                    # (since this operation will alter it)
                    if not self.parent_can_be_changed(node, pid, protocol, processed_nodes):
                        can_process_node = False

                if can_process_node:
                    protocol_str += self.process_node(node, protocol)
                    processed_nodes.append(node)
                    operation_nodes.remove(node)

        protocol_str += self.get_footer(protocol_name)
        return protocol_str

    @staticmethod
    def parent_can_be_changed(node, parent_node_id, protocol, processed_nodes):
        node_id = node["id"]

        # if link is not 'addToThis' we do not need to consider further, as parent will not be changed
        for link in protocol["links"]:
            if link["source_id"] == parent_node_id and link["target_id"] == node_id and not link["data"]["addToThis"]:
                return True

        # construct list containing id of all nodes equivalent to parent
        if node["type"] == "resource":
            parent = filter(lambda x: x["id"] == parent_node_id, protocol["nodes"])[0]
            nodes_equivalent_to_parent = filter(
                lambda x: x["type"] == "resource" and x["data"]["resource"] == parent["data"]["resource"], protocol["nodes"])
        else:
            nodes_equivalent_to_parent = [parent_node_id]

        # if these are the inputs to any un-processed nodes (other than the node being considered), we can't change the parent yet
        for link in protocol["links"]:
            if link["source_id"] not in nodes_equivalent_to_parent or link["target_id"] == node_id:
                continue

            if link["target_id"] not in map(lambda x: x["id"], processed_nodes):
                return False

        return True

    def get_footer(self, protocol_name):
        return ""

    def get_complete_rows(self, well_addresses, target_container):
        # We need to look up the properties of the particular container used

        code_dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
        with open( os.path.join(code_dir, 'static/default-containers.json')) as c:
            container_types = json.load(c)["containers"]

        target_container_type = filter(lambda x: self.sanitise_name(x["name"]) == target_container, self.protocol["containers"])[0]["type"]
        target_container_wells = container_types[target_container_type]["locations"].keys()
        target_container_cols = set(map(lambda x: x[0], target_container_wells))
        target_container_rows = set(map(lambda x: int(x[1:]), target_container_wells))

        # return row numbers for complete rows
        rows = list(set(map(lambda x: x[1:], well_addresses)))

        complete_rows = []
        for row in rows:
            addresses = filter(lambda x: x[1:] == row, well_addresses)

            columns = map(lambda x: x[0], addresses)
            if len(set(columns)) == len(target_container_cols):
                complete_rows.append(row)

        return complete_rows, target_container_cols, target_container_rows

    @staticmethod
    def get_options(link_data):
        return ""

    @staticmethod
    def sanitise_name(name):
        return name

    @staticmethod
    def get_locations(protocol, node):

        if node["type"] == "process":
            parent_node_id = node["parentIds"][0]
            parent = filter(lambda x: x["id"] == parent_node_id, protocol["nodes"])[0]
            return Converter.get_locations(protocol, parent)

        # process nodes have no container
        if "container_name" not in node["data"].keys() or not node["data"]["container_name"]:
            return []

        container = filter(lambda x: x["name"] == node["data"]["container_name"], protocol["containers"])[0]

        locations = []
        for well_address in container["contents"]:

            for contents in container["contents"][well_address]:
                aliquot_index = int(contents["aliquot_index"])

                print "node:", node
                if int(contents["node_id"]) == int(node["id"]):
                    while aliquot_index + 1 > len(locations):
                        locations.append(None)

                    locations[aliquot_index] = well_address

        return locations


    def get_parent_nodes(self, node, protocol):
        parent_nodes = []
        parent_nodes.extend(filter(lambda x: x["id"] == node["parentIds"][0], protocol["nodes"]))
        if len(node["parentIds"]) > 1:
            parent_nodes.extend(filter(lambda x: x["id"] == node["parentIds"][1], protocol["nodes"]))

        for i in range(0, len(parent_nodes)):

            if parent_nodes[i]["type"] == "resource":
                resources = protocol["resources"]
                resource = list(filter(lambda r: r["label"] == parent_nodes[i]["data"]["resource"], resources))[0]

                # replace reference to reference to lowest node_id with same target
                for n in protocol["nodes"]:
                    if n["type"] == "resource" and n["data"]["resource"] == parent_nodes[i]["data"]["resource"] and n["id"] < parent_nodes[i]["id"]:
                        parent_nodes[i] = n

                parent_nodes[i]["data"]["container_name"] = resource["data"]["container_name"]

        return parent_nodes

    def process_node(self, node, protocol):

        num_duplicates = int(node["data"]["num_duplicates"])
        parent_nodes = self.get_parent_nodes(node, protocol)

        link_one_data = filter(lambda x: x["source_id"] == node["parentIds"][0] and x["target_id"] == node["id"],
                               protocol["links"])[0]["data"]

        if len(link_one_data["volumes"]) > 0:
            volumes_one = str(link_one_data["volumes"][0]).split(",")
        else:
            volumes_one = [0.1] # for pick operation, no volume is set

        container_one = self.sanitise_name(parent_nodes[0]["data"]["container_name"])
        pipette_name_one = self.sanitise_name(link_one_data["pipette_name"])
        locations_one = self.get_locations(protocol, parent_nodes[0])

        (link_two_data, container_two, pipette_name_two, locations_two) = (False, False, False, False)
        if len(parent_nodes) > 1:
            link_two_data = filter(lambda x: x["source_id"] == node["parentIds"][1] and x["target_id"] == node["id"],
                                   protocol["links"])[0]["data"]
            volumes_two = str(link_two_data["volumes"][0]).split(",")
            container_two = self.sanitise_name(parent_nodes[1]["data"]["container_name"])
            pipette_name_two = self.sanitise_name(link_two_data["pipette_name"])
            locations_two = self.get_locations(protocol, parent_nodes[1])

        container_target = self.sanitise_name(node["data"]["container_name"])
        locations_result = self.get_locations(protocol, node)

        # if the user takes an aliquot, and sets container to be a trash_container, then all target wells will be A1
        # This violates the one-to-one/one-to-many mapping from source wells to target wells (it is many-to-one)
        # it therefore needs to be handled as a 'pool' operation
        if len(set(locations_result)) == 1 and len(locations_one) > 1:
            node["type"] = "pool"
            locations_result = locations_result[0:1]

        # First work out which liquids are transferred into which wells
        source_one = {}
        source_two = {}
        t_volume_one = {}
        t_volume_two = {}

        if node["type"] == "process":
            # find parent node's well assignments
            container_name = parent_nodes[0]["data"]["container_name"]
            container_contents = filter(lambda x: x["name"] == container_name, protocol["containers"])[0]["contents"]

            well_locations = []
            for well_address in container_contents:
                for contents in container_contents[well_address]:
                    if int(contents["node_id"]) == int(parent_nodes[0]["id"]):
                        well_locations.append(well_address)


            return self.get_process_string(node["data"], node["operation"]["data"]["options"], well_locations)

        elif node["type"] == "pool":
            protocol_str = ""
            source_str = ", ".join(map(lambda x: "'" + x + "'", locations_one))

            if len(volumes_one) == 1:
                volumes_str = volumes_one[0]
            else:
                volumes_str = "[" + ", ".join(volumes_one) + "]"

            for target in locations_result:
                protocol_str += self.get_consolidate_string(pipette_name_one, volumes_str, container_one, source_str,
                                                            container_target, target, self.get_options(link_one_data))

            return protocol_str

        elif node["type"] == "zip":

            if len(locations_one) == 1:
                locations_one = locations_one * len(locations_two)

            if len(locations_two) == 1:
                locations_two = locations_two * len(locations_one)

            if len(volumes_one) == 1:
                volumes_one = volumes_one * len(locations_two)

            if len(volumes_two) == 1:
                volumes_two = volumes_two * len(locations_one)

            well_index = 0
            for repeat_number in range(0, num_duplicates):
                for i in range(0, len(locations_one)):
                    target_well = locations_result[well_index]
                    source_one[target_well] = locations_one[i]
                    source_two[target_well] = locations_two[i]
                    t_volume_one[target_well] = volumes_one[i]
                    t_volume_two[target_well] = volumes_two[i]
                    well_index += 1

            return self.do_transfer(source_one, container_one, t_volume_one, pipette_name_one, link_one_data,
                                    source_two, container_two, t_volume_two, pipette_name_two, link_two_data,
                                    locations_result, container_target)

        elif node["type"] == "cross":

            if len(volumes_one) == 1:
                volumes_one = volumes_one * len(locations_one) * len(locations_two)

            if len(volumes_two) == 1:
                volumes_two = volumes_two * len(locations_one) * len(locations_two)

            well_index = 0
            for repeat_number in range(0, num_duplicates):
                for i in range(len(locations_one)):
                    for j in range(len(locations_two)):
                        target_well = locations_result[well_index]
                        source_one[target_well] = locations_one[i]
                        source_two[target_well] = locations_two[j]
                        t_volume_one[target_well] = volumes_one[i]
                        t_volume_two[target_well] = volumes_two[j]
                        well_index += 1

            return self.do_transfer(source_one, container_one, t_volume_one, pipette_name_one, link_one_data,
                                          source_two, container_two, t_volume_two, pipette_name_two, link_two_data,
                                          locations_result, container_target)

        elif node["type"] == "pick":

            pick_string = ""
            well_index = 0
            for repeat_number in range(0, num_duplicates):
                for i in range(0, len(locations_one)):
                    pick_string += self.get_pick_string(container_one, locations_one[i], container_target, locations_result[well_index], node["data"]["min_colonies"])
                    well_index += 1
            return pick_string

        elif node["type"] == "spread":
            # extend locations to match length of volumes (if we are crossing a single well with a list of volumes)
            if len(locations_one) == 1:
                locations_one = locations_one * len(volumes_one)
            elif len(volumes_one) == 1:
                volumes_one = volumes_one * len(locations_one)

            well_index = 0
            spread_string = ""
            for repeat_number in range(0, num_duplicates):

                for i in range(0, len(locations_one)):
                    spread_string += self.get_spread_string(container_one, locations_one[i], container_target,
                                                            locations_result[well_index], volumes_one[i])
                    well_index += 1

            return spread_string

        elif node["type"] == "select" or node["type"] == "aliquot":

            # extend locations to match length of volumes (if we are crossing a single well with a list of volumes)
            if len(locations_one) == 1:
                locations_one = locations_one * len(volumes_one)
            elif len(volumes_one) == 1:
                volumes_one = volumes_one * len(locations_one)

            well_index = 0
            source_two = False
            for repeat_number in range(0, num_duplicates):
                for i in range(0, len(locations_one)):
                    target_well = locations_result[well_index]
                    source_one[target_well] = locations_one[i]
                    t_volume_one[target_well] = volumes_one[i]
                    well_index += 1

            return self.do_transfer(source_one, container_one, t_volume_one, pipette_name_one, link_one_data,
                                    source_two, container_two, t_volume_two, pipette_name_two, link_two_data,
                                    locations_result, container_target)

    def do_single_transfer(self, source, container, volumes, pipette_name, link_data,
                           locations_result, container_target):

        if link_data["addToThis"]:
            return ""

        transfers_made = []
        protocol_str = ""

        # Look for complete rows that can be pipetted together
        target_container_type = filter(lambda x: self.sanitise_name(x["name"]) == container_target, self.protocol["containers"])[0]["type"]
        source_container_type = filter(lambda x: self.sanitise_name(x["name"]) == container, self.protocol["containers"])[0]["type"]

        complete_rows, target_container_cols, target_container_rows = self.get_complete_rows(locations_result, container_target)
        _, source_container_cols, source_container_rows = self.get_complete_rows(locations_result, container)

        if len(source_container_cols) == len(target_container_cols):

            for result_row in complete_rows:
                source_row = source['A' + result_row][1:]
                # check corresponding wells in first source are in a row, and columns are in consistent order with results
                is_valid = True

                # all volumes must be equal for a multi-well transfer
                if len(set(volumes.values())) > 1:
                    is_valid = False
                else:
                    volume = volumes.values()[0]

                for column in target_container_cols:
                    source_well = source[column + result_row]

                    if source_well[1:] != source_row:
                        is_valid = False
                        break

                    if source_well[0] != column:
                        is_valid = False
                        break

                if is_valid and not (container_target == container and source_row == result_row) and not link_data["addToThis"]:
                    protocol_str += self.get_transfer_string(pipette_name, volume, container, source_row,
                                                             container_target, result_row, self.get_options(link_data), target_container_cols)

                    transfers_made.extend(map(lambda x: x + str(result_row), target_container_cols))

        # now do remaining individual transfers,
        # grouping transfers from the same well into distribute operations if permitted
        wells_to_fill = locations_result
        map(lambda x: locations_result.remove(x), transfers_made)

        if link_data["distribute"]:
            transfers = {}

            for target_well in wells_to_fill:
                source_well = source[target_well]
                if source_well not in transfers.keys():
                    transfers[source_well] = []
                transfers[source_well].append(target_well)

            for (source, volume) in zip(transfers, volumes):
                targets_str = ", ".join(map(lambda x: "'" + x + "'", transfers[source]))

                these_volumes = map(lambda x: volumes[x], transfers[source])
                if len(set(these_volumes)) == 1:
                    volume_str = these_volumes[0]
                else:
                    volume_str = "[" + ", ".join(these_volumes) + "]"

                protocol_str += self.get_distribute_string(pipette_name, volume_str, container, source,
                                                           container_target, targets_str, self.get_options(link_data))

        else:

            for target_well in wells_to_fill:
                source_well = source[target_well]
                volume = volumes[target_well]
                protocol_str += self.get_transfer_well_string(pipette_name, volume, container, source_well,
                                                              container_target, target_well, self.get_options(link_data))

        return protocol_str


    def do_transfer(self, source_one, container_one, volumes_one, pipette_name_one, link_one_data,
                    source_two, container_two, volumes_two, pipette_name_two, link_two_data,
                    locations_result, container_target):

        # Do transfer from first parent node
        protocol_str_one = self.do_single_transfer(source_one, container_one, volumes_one, pipette_name_one, link_one_data,
                           locations_result, container_target)

        # Do transfer from second parent node
        protocol_str_two = ""
        if source_two:
            protocol_str_two = self.do_single_transfer(source_two, container_two, volumes_two, pipette_name_two, link_two_data,
                               locations_result, container_target)

        # Return complete commands
        if source_two and link_two_data["addFirst"]:
            protocol_str = protocol_str_two + protocol_str_one
        else:
            protocol_str = protocol_str_one + protocol_str_two
        protocol_str += "\n"
        return protocol_str

    @staticmethod
    def sanitise_name(name):
        name = name.replace(' ', '_')
        name = name.replace('-', '_')
        return name
