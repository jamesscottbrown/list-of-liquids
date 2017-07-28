# TODO:
# automatic pipette assignment
# what if names of pipeetes/containers include spaces or other forbidden characters?
# other operations - e.g. select, incubate, etc.

# multi-channel transfer
from protocol_gui.protocol.converter import Converter

class OpenTrons(Converter):

    def get_header(self, protocol, protocol_name):
        opentrons_protocol = ""

        opentrons_protocol += "from opentrons import containers, instruments\n\n"

        for container in protocol["containers"]:
            opentrons_protocol += '%s = containers.load("%s", "%s")\n' \
                                  % (container["name"], container["type"], container["location"])
        opentrons_protocol += "\n"

        for pipette in protocol["pipettes"]:
            opentrons_protocol += """%s = instruments.Pipette(axis="%s",
        max_volume="%s",
        min_volume="%s",
        channels="%s",
        aspirate_speed="%s",
        dispense_speed="%s",
        tip_racks=%s,
        name="%s")\n\n""" \
            % (pipette["name"], pipette["axis"], pipette["volume"], pipette["min_volume"],  pipette["channels"],
               pipette["aspirateSpeed"], pipette["dispenseSpeed"], pipette["tipracks"], pipette["name"])

        opentrons_protocol += "\n"
        return opentrons_protocol

    def get_consolidate_string(self, pipette_name, volume_one, container_one, source_str, container_target, target, options_str):
        return "%s.consolidate(%s, %s.wells(%s), %s.well('%s')%s)\n" % (pipette_name, volume_one, container_one, source_str, container_target, target, options_str)

    # disitinguish between transfer rows and cells
    def get_transfer_string(self, pipette_name, volume_one, container_one, source_row, container_target, result_row, options_str):
        return "%s.transfer(%s, %s.rows('%s'), %s.rows('%s')%s)\n" % (
        pipette_name, volume_one, container_one, source_row, container_target, result_row, options_str)

    def get_transfer_well_string(self, pipette_name, volume_one, container_one, source_row, container_target, result_row, options_str):
        return "%s.transfer(%s, %s.well('%s'), %s.well('%s')%s)\n" % (
        pipette_name, volume_one, container_one, source_row, container_target, result_row, options_str)

    def get_distribute_string(self, pipette_name, volume_two, container_two, source, container_target, targets_str, options_str):
        return "%s.distribute(%s, %s.well('%s'), %s.wells(%s)%s)\n" % (pipette_name, volume_two, container_two, source, container_target, targets_str, options_str)


    def process_node(self, node, protocol):
        protocol_str_one = ""
        protocol_str_two = ""

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

        if len(node["parentIds"]) > 1:
            link_two_data = filter(lambda x: x["source_id"] == node["parentIds"][1] and x["target_id"] == node["id"],
                                   protocol["links"])[0]["data"]
            volume_two = link_two_data["volumes"][0]
            container_two = parent_nodes[1]["data"]["container_name"]
            locations_two = self.get_locations(protocol, parent_nodes[1])

        container_target = node["data"]["container_name"]
        locations_result = self.get_locations(protocol, node)

        # First work out which liquids are transferred into which wells
        source_one = {}
        source_two = {}
        if node["type"] == "zip":
            well_index = 0
            for repeat_number in range(0, num_duplicates):
                for i in range(0, len(locations_one)):
                    target_well = locations_result[well_index]
                    source_one[target_well] = locations_one[i]
                    source_two[target_well] = locations_two[i]
                    well_index += 1

        elif node["type"] == "cross":
            well_index = 0
            for repeat_number in range(0, num_duplicates):
                for a in locations_one:
                    for b in locations_two:
                        target_well = locations_result[well_index]
                        source_one[target_well] = a
                        source_two[target_well] = b
                        well_index += 1

        elif node["type"] == "process":
            pass

        elif node["type"] == "pool":
            protocol_str = ""
            source_str = ""
            for source in locations_one:
                source_str = ", ".join(map(lambda x: "'" + x + "'", source))

            for target in locations_result:
                protocol_str += get_consolidate_string(link_one_data["pipette_name"], volume_one, container_one, source_str, container_target, target, self.get_options(link_one_data))

            return protocol_str

        elif node["type"] == "select" or node["type"] == "aliquot":
            well_index = 0
            source_two = False
            for repeat_number in range(0, num_duplicates):
                for i in range(0, len(locations_one)):
                    target_well = locations_result[well_index]
                    source_one[target_well] = locations_one[i]
                    well_index += 1

        # Then make the transfers
        transfers_made_one = []
        transfers_made_two = []

        # Look for rows that can be pipetted together
        for result_row in self.get_complete_rows(locations_result):

            source_row = source_one['A' + result_row][1:]
            # check corresponding wells in first source are in a row, and columns are in consistent order with results
            isValid = True
            for column in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']:
                source_well = source_one[column + result_row]

                if source_well[1:] != source_row:
                    isValid = False
                    break

                if source_well[0] != column:
                    isValid = False
                    break

            if isValid and not (container_target == container_one and source_row == result_row):
                protocol_str_one += self.get_transfer_string(link_one_data["pipette_name"], volume_one, container_one,
                                                        source_row, container_target, result_row, self.get_options(link_one_data))

                transfers_made_one.extend(map(lambda x: x + str(result_row), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']))

            if source_two:
                source_row = source_two['A' + result_row][1:]
                # check corresponding wells in first source are in a row, and columns are in consistent order with results
                isValid = True
                for column in ['A', 'C', 'D', 'E', 'F', 'G', 'H']:
                    source_well = source_two[column + result_row]

                    if source_well[1:] != source_row:
                        isValid = False
                        break

                    if source_well[0] != column:
                        isValid = False
                        break

                if isValid and not (container_target == container_one and source_row == result_row):
                    protocol_str_two += self.get_transfer_string(link_two_data["pipette_name"], volume_two, container_two, source_row, container_target, result_row, self.get_options(link_two_data))
                    transfers_made_two.extend(map(lambda x: x + str(result_row), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']))

        # now do remaining individual transfers, grouping transfers from the same well int distribute operations if permitted
        wells_to_fill = list(set(locations_result) - set(transfers_made_one))

        if link_one_data["distribute"]:
            transfers = {}

            for target_well in wells_to_fill:
                source_well = source_one[target_well]
                if source_well not in transfers.keys():
                    transfers[source_well] = []
                transfers[source_well].append(target_well)

            for source in transfers:
                targets_str = ", ".join(map(lambda x: "'" + x + "'", transfers[source]))
                protocol_str_one += self.get_distribute_string(link_one_data["pipette_name"], volume_one, container_one, source, container_target, targets_str, self.get_options(link_one_data))

        else:
            for target_well in wells_to_fill:
                source_well = source_one[target_well]
                protocol_str_one += self.get_transfer_well_string(link_one_data["pipette_name"], volume_one, container_one, source_well, container_target, target_well, self.get_options(link_one_data))

        if source_two:
            wells_to_fill = list(set(locations_result) - set(transfers_made_two))
            if link_two_data["distribute"]:
                transfers = {}

                for target_well in wells_to_fill:
                    source_well = source_two[target_well]
                    if source_well not in transfers.keys():
                        transfers[source_well] = []
                    transfers[source_well].append(target_well)

                for source in transfers:
                    targets_str = ", ".join(map(lambda x: "'" + x + "'", transfers[source]))
                    protocol_str_two += self.get_distribute_string(link_two_data["pipette_name"], volume_two, container_two, source, container_target, targets_str, self.get_options(link_two_data))
            else:

                for target_well in wells_to_fill:
                    source_well = source_two[target_well]
                    protocol_str_two += sef.get_transfer_well_string(link_two_data["pipette_name"], volume_two, container_two, source_well, container_target, target_well, self.get_options(link_two_data))

        if source_two and link_two_data["addFirst"]:
            protocol_str = protocol_str_two + protocol_str_one
        else:
            protocol_str = protocol_str_one + protocol_str_two
        protocol_str += "\n"
        return protocol_str
