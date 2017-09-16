class Converter:
    def __init__(self):
        pass

    def convert(self, protocol, protocol_name):
        protocol_str = self.get_header(protocol, protocol_name)

        # do a topological sort on the operations graph; then convert each operation to a stamp or pipette
        operation_nodes = filter(lambda x: x["type"] in ["zip", "cross", "process", "pool", "aliquot", "select"],
                                 protocol["nodes"])
        processed_nodes = filter(lambda x: x["type"] == "resource", protocol["nodes"])

        while len(operation_nodes) > 0:
            for node in operation_nodes:

                can_process_node = True
                parentIDs = node["parentIds"]
                for pid in parentIDs:

                    # if parent has not been processed, cannot process node yet
                    if not filter(lambda x: x["id"] == pid, processed_nodes):
                        can_process_node = False

                    # if edge is 'addToThis', we must do any other operations involving the parent first
                    # (since this operation will alter it)
                    node_id = node["id"]
                    links_from_parent_to_other_nodes = filter(lambda x: x["source_id"] == pid and not x["target_id"] == node_id, protocol["links"])
                    links_from_parent_to_node = filter(lambda x: x["source_id"] == pid and x["target_id"] == node_id, protocol["links"])[0]
                    added_to_this_node = links_from_parent_to_node["data"]["addToThis"]
                    for link in links_from_parent_to_other_nodes:
                        if added_to_this_node and (link["target_id"] not in map(lambda x: x["id"], processed_nodes)):
                            can_process_node = False

                if can_process_node:
                    protocol_str += self.process_node(node, protocol)
                    processed_nodes.append(node)
                    operation_nodes.remove(node)

        protocol_str += self.get_footer(protocol_name)
        return protocol_str


    def get_footer(self, protocol_name):
        return ""

    @staticmethod
    def get_complete_rows(well_addresses):
        # TODO: container is now no longer guaranteed to be 96 well plate!

        # return row numbers for complete rows
        rows = list(set(map(lambda x: x[1:], well_addresses)))

        complete_rows = []
        for row in rows:
            addresses = filter(lambda x: x[1:] == row, well_addresses)

            columns = map(lambda x: x[0], addresses)
            if len(set(columns)) == 8:
                complete_rows.append(row)

        return complete_rows

    @staticmethod
    def get_options(link_data):
        return ""

    @staticmethod
    def sanitise_name(name):
        return name

    @staticmethod
    def get_locations(protocol, node):

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


    def process_node(self, node, protocol):
        protocol_str_one = ""
        protocol_str_two = ""

        num_duplicates = int(node["data"]["num_duplicates"])

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
                    if n["type"] == "resource" and n["data"]["resource"] == parent_nodes[i]["data"]["resource"] and n["id"] <  parent_nodes[i]["id"]:
                        parent_nodes[i] = n


                parent_nodes[i]["data"]["container_name"] = resource["data"]["container_name"]

        # skip operation if from somewhere to same place
        link_one_data = filter(lambda x: x["source_id"] == node["parentIds"][0] and x["target_id"] == node["id"],
                               protocol["links"])[0]["data"]
        volume_one = link_one_data["volumes"][0]
        container_one = self.sanitise_name(parent_nodes[0]["data"]["container_name"])
        pipette_name_one = self.sanitise_name(link_one_data["pipette_name"])
        locations_one = self.get_locations(protocol, parent_nodes[0])

        if len(node["parentIds"]) > 1:
            link_two_data = filter(lambda x: x["source_id"] == node["parentIds"][1] and x["target_id"] == node["id"],
                                   protocol["links"])[0]["data"]
            volume_two = link_two_data["volumes"][0]
            container_two = self.sanitise_name(parent_nodes[1]["data"]["container_name"])
            pipette_name_two = self.sanitise_name(link_two_data["pipette_name"])
            locations_two = self.get_locations(protocol, parent_nodes[1])

        container_target = self.sanitise_name(node["data"]["container_name"])
        locations_result = self.get_locations(protocol, node)

        volumes_one = str(volume_one).split(",")
        if len(volumes_one) == 1:
            volumes_one = volumes_one * len(locations_one)

        if len(node["parentIds"]) > 1:
            volumes_two = str(volume_two).split(",")
            if len(volumes_two) == 1:
                volumes_two = volumes_two * len(locations_two)


        # if the user takes an aliquot, and sets container to be a trash_container, then all target wells will be A1
        # This violates the one-to-one/one-to-many mapping from source wells to target wells (it is many-to-one)
        # it therefore needs to be handled as a 'pool' operation
        if len(set(locations_result)) == 1 and len(locations_one) > 1:
            node["type"] = "pool"
            locations_result = locations_result[0:1]

        # First work out which liquids are transferred into which wells
        source_one = {}
        source_two = {}
        if node["type"] == "zip":

            # if we are zipping with a single well, extend
            if len(locations_one) == 1:
                locations_one = locations_one * len(locations_two)

            if len(locations_two) == 1:
                locations_two = locations_two * len(locations_one)

            well_index = 0
            for repeat_number in range(0, num_duplicates):
                for i in range(0, len(locations_one)):
                    target_well = locations_result[well_index]
                    source_one[target_well] = locations_one[i]
                    source_two[target_well] = locations_two[i]
                    well_index += 1

        elif node["type"] == "cross":

            if len(volumes_one) == 1:
                volumes_one = volumes_one * (len(locations_one) * len(locations_two))
            volumes_one = volumes_one * num_duplicates

            if len(volumes_two) == 1:
                volumes_two = volumes_two * (len(locations_one) * len(locations_two))
            volumes_two = volumes_two * num_duplicates

            well_index = 0
            for repeat_number in range(0, num_duplicates):
                for a in locations_one:
                    for b in locations_two:
                        target_well = locations_result[well_index]
                        source_one[target_well] = a
                        source_two[target_well] = b
                        well_index += 1

        elif node["type"] == "process":
            return self.get_process_string(node["data"]["command"])

        elif node["type"] == "pool":
            protocol_str = ""
            source_str = ", ".join(map(lambda x: "'" + x + "'", locations_one))

            for (target, volume) in zip(locations_result, volumes_one):
                protocol_str += self.get_consolidate_string(pipette_name_one, volume, container_one, source_str,
                                                       container_target, target, self.get_options(link_one_data))

            return protocol_str

        elif node["type"] == "select" or node["type"] == "aliquot":
            well_index = 0
            source_two = False
            for repeat_number in range(0, num_duplicates):
                for i in range(0, len(locations_one)):
                    target_well = locations_result[well_index]
                    source_one[target_well] = locations_one[i]
                    well_index += 1

            # do further extension if needed due to repeats
            volumes_one = volumes_one * num_duplicates

        # Then make the transfers
        transfers_made_one = []
        transfers_made_two = []

        # Look for rows that can be pipetted together
        for result_row in self.get_complete_rows(locations_result):

            source_row = source_one['A' + result_row][1:]
            # check corresponding wells in first source are in a row, and columns are in consistent order with results
            isValid = True

            # all volumes must be equal for a multi-well transfer
            if len(set(volumes_one)) > 1:
                isValid = False

            for column in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']:
                source_well = source_one[column + result_row]

                if source_well[1:] != source_row:
                    isValid = False
                    break

                if source_well[0] != column:
                    isValid = False
                    break

            if isValid and not (container_target == container_one and source_row == result_row) and not link_one_data["addToThis"]:
                protocol_str_one += self.get_transfer_string(pipette_name_one, volume_one, container_one,
                                                             source_row, container_target, result_row,
                                                             self.get_options(link_one_data))

                transfers_made_one.extend(map(lambda x: x + str(result_row), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']))

            if source_two and not link_two_data["addToThis"]:
                source_row = source_two['A' + result_row][1:]
                # check corresponding wells in first source are in a row, and columns are in consistent order with results
                isValid = True

                if len(set(volumes_two)) > 1:
                    isValid = False

                for column in ['A', 'C', 'D', 'E', 'F', 'G', 'H']:
                    source_well = source_two[column + result_row]

                    if source_well[1:] != source_row:
                        isValid = False
                        break

                    if source_well[0] != column:
                        isValid = False
                        break

                if isValid and not (container_target == container_one and source_row == result_row):
                    protocol_str_two += self.get_transfer_string(pipette_name_two, volume_two, container_two,
                                                                 source_row, container_target, result_row,
                                                                 self.get_options(link_two_data))
                    transfers_made_two.extend(map(lambda x: x + str(result_row), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']))

        # now do remaining individual transfers, grouping transfers from the same well int distribute operations if permitted
        wells_to_fill = locations_result
        map(lambda x: locations_result.remove(x), transfers_made_one)

        if link_one_data["distribute"] and not link_one_data["addToThis"]:
            transfers = {}

            for target_well in wells_to_fill:
                source_well = source_one[target_well]
                if source_well not in transfers.keys():
                    transfers[source_well] = []
                transfers[source_well].append(target_well)

            for (source, volume) in zip(transfers, volumes_one):
                targets_str = ", ".join(map(lambda x: "'" + x + "'", transfers[source]))
                protocol_str_one += self.get_distribute_string(pipette_name_one, volume, container_one,
                                                               source, container_target, targets_str,
                                                               self.get_options(link_one_data))

        elif not link_one_data["addToThis"]:

            for (target_well, volume) in zip(wells_to_fill, volumes_one):
                source_well = source_one[target_well]
                protocol_str_one += self.get_transfer_well_string(pipette_name_one, volume, container_one,
                                                                  source_well, container_target, target_well,
                                                                  self.get_options(link_one_data))

        if source_two and not link_two_data["addToThis"]:
            wells_to_fill = locations_result
            map(lambda x: locations_result.remove(x), transfers_made_two)

            if link_two_data["distribute"]:
                transfers = {}

                for target_well in wells_to_fill:
                    source_well = source_two[target_well]
                    if source_well not in transfers.keys():
                        transfers[source_well] = []
                    transfers[source_well].append(target_well)

                for (source, volume) in zip(transfers, volumes_two):
                    targets_str = ", ".join(map(lambda x: "'" + x + "'", transfers[source]))
                    protocol_str_two += self.get_distribute_string(pipette_name_two, volume, container_two,
                                                                   source, container_target, targets_str,
                                                                   self.get_options(link_two_data))
            elif not link_two_data["addToThis"]:

                for (target_well, volume) in zip(wells_to_fill, volumes_two):
                    source_well = source_two[target_well]
                    protocol_str_two += self.get_transfer_well_string(pipette_name_two, volume,
                                                                     container_two, source_well, container_target,
                                                                     target_well, self.get_options(link_two_data))

        if source_two and link_two_data["addFirst"]:
            protocol_str = protocol_str_two + protocol_str_one
        else:
            protocol_str = protocol_str_one + protocol_str_two
        protocol_str += "\n"
        return protocol_str
