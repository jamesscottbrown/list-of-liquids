# TODO:
# automatic pipette assignment
# what if names of pipeetes/containers include spaces or other forbidden characters?
# other operations - e.g. select, incubate, etc.

# multi-channel transfer


def get_opentrons_protocol(protocol):
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
    name="%s")
    """ \
        % (pipette["name"], pipette["axis"], pipette["volume"], pipette["min_volume"],  pipette["channels"],
           pipette["aspirateSpeed"], pipette["dispenseSpeed"], pipette["tipracks"], pipette["name"])

    opentrons_protocol += "\n"

    # do a topological sort on the operations graph; then convert each operation to a stamp or pipette
    operation_nodes = filter(lambda x: x["type"] in ["zip", "cross", "process"], protocol["nodes"])
    processed_nodes = filter(lambda x: x["type"] == "well", protocol["nodes"])

    while len(operation_nodes) > 0:
        for node in operation_nodes:

            has_unprocessed_parents = False
            parentIDs = node["parentIds"]
            for pid in parentIDs:
                if not filter(lambda x: x["id"] == pid, processed_nodes):
                    has_unprocessed_parents = True

            if not has_unprocessed_parents:
                opentrons_protocol += process_node(node, protocol)
                processed_nodes.append(node)
                operation_nodes.remove(node)

    return opentrons_protocol


def process_node(node, protocol):
    protocol_str = ""

    num_duplicates = int(node["data"]["num_duplicates"])
    parent_nodes = filter(lambda x: x["id"] in node["parentIds"], protocol["nodes"])

    # skip operation if from somewhere to same place
    link_one_data = filter(lambda x: x["source_id"] == node["parentIds"][0] and x["target_id"] == node["id"],
                           protocol["links"])[0]["data"]
    link_two_data = filter(lambda x: x["source_id"] == node["parentIds"][1] and x["target_id"] == node["id"],
                           protocol["links"])[0]["data"]

    volume_one = link_one_data["volumes"][0]
    volume_two = link_two_data["volumes"][0]


    print "Parent one:", parent_nodes[0]
    container_one = parent_nodes[0]["data"]["container_name"]
    container_two = parent_nodes[0]["data"]["container_name"]
    container_target = node["data"]["container_name"]

    locations_one = get_locations(protocol, parent_nodes[0])
    locations_two = get_locations(protocol, parent_nodes[1])
    locations_result = get_locations(protocol, node)

    if node["type"] == "zip":

        well_index = 0
        for repeat_number in range(0, num_duplicates):

            for i in range(0, len(locations_one)):
                target_well = locations_result[well_index]

                source_well = locations_one[i]
                if source_well != target_well:
                    protocol_str += "%s.transfer(%s, %s.wells('%s'), %s.wells('%s'))\n" \
                                    % (link_one_data["pipette_name"], volume_one, container_one, source_well,
                                       container_target, target_well)

                source_well = locations_two[i]
                if source_well != target_well:
                    protocol_str += "%s.transfer(%s, %s.wells('%s'), %s.wells('%s'))\n" \
                                    % (link_two_data["pipette_name"], volume_two, container_two, source_well,
                                       container_target, target_well)

                well_index += 1

        print "\n\n"

    elif node["type"] == "cross":

        i = 0
        for repeat_number in range(0, num_duplicates):

            for a in locations_one:
                for b in locations_two:

                    target_well = locations_result[i]
                    if a != target_well:
                        protocol_str += "%s.transfer(%s, %s.wells('%s'), %s.wells('%s'))\n" \
                                        % (link_one_data["pipette_name"], volume_one, container_one, a,
                                           container_target, target_well)

                    if b != target_well:
                        protocol_str += "%s.transfer(%s, %s.wells('%s'), %s.wells('%s'))\n" \
                                        % (link_two_data["pipette_name"], volume_two, container_two, b,
                                           container_target, target_well)
                    i += 1
        print "\n\n"

    return protocol_str


def get_locations(protocol, node):
    container = filter(lambda x: x["name"] == node["data"]["container_name"], protocol["containers"])[0]

    locations = []
    for well_address in container["contents"]:
        contents = container["contents"][well_address]
        aliquot_index = int(contents["aliquot_index"])

        if int(contents["operation_index"]) == int(node["id"]):
            while aliquot_index + 1 > len(locations):
                locations.append(None)

            locations[aliquot_index] = well_address

    return locations
