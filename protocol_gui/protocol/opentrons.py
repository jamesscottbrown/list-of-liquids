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
    name="%s")\n\n""" \
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
    protocol_str_one = ""
    protocol_str_two = ""

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

    # Then make the transfers
    transfers_made_one = []
    transfers_made_two = []

    # Look for rows that can be pipetted together
    for result_row in get_complete_rows(locations_result):

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
            protocol_str_one += "%s.transfer(%s, %s.rows('%s'), %s.rows('%s')%s)\n" % (link_one_data["pipette_name"], volume_one, container_one, source_row, container_target, result_row, get_options(link_one_data))
            transfers_made_one.extend(map(lambda x: x + str(result_row), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']))


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
            protocol_str_two += "%s.transfer(%s, %s.rows('%s'), %s.rows('%s')%s)\n" % (link_two_data["pipette_name"], volume_two, container_two, source_row, container_target, result_row, get_options(link_two_data))
            transfers_made_two.extend( map(lambda x: x + str(result_row), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']))

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
            protocol_str_one += "%s.distribute(%s, %s.well('%s'), %s.wells('%s')%s)\n" % (link_one_data["pipette_name"], volume_one, container_one, source, container_target, target_str, get_options(link_one_data))

    else:
        for target_well in wells_to_fill:
            source_well = source_one[target_well]
            protocol_str_one += "%s.transfer(%s, %s.well('%s'), %s.well('%s')%s)\n" % (link_one_data["pipette_name"], volume_one, container_one, source_well, container_target, target_well, get_options(link_one_data))

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

        protocol_str_two += "%s.distribute(%s, %s.well('%s'), %s.wells('%s')%s)\n" % (link_two_data["pipette_name"], volume_two, container_two, source, container_target, targets_str, get_options(link_two_data))
    else:

        for target_well in wells_to_fill:
            source_well = source_two[target_well]
            protocol_str_two += "%s.transfer(%s, %s.well('%s'), %s.well('%s')%s)\n" % (link_two_data["pipette_name"], volume_two, container_two, source_well, container_target, target_well, get_options(link_two_data))


    if link_two_data["addFirst"]:
        protocol_str =  protocol_str_two + protocol_str_one
    else:
       protocol_str = protocol_str_one + protocol_str_two
    protocol_str += "\n"
    return protocol_str


def get_complete_rows(well_addresses):
    # return row numbers for complete rows
    rows = list(set(map(lambda x: x[1:], well_addresses)))

    complete_rows = []
    for row in rows:
        addresses = filter(lambda x: x[1:] == row, well_addresses)

        columns = map(lambda x: x[0], addresses)
        if len(set(columns)) == 8:
            complete_rows.append(row)

    return complete_rows


def get_options(link_data):
    opts = []

    # new_tip should be "always" or "never"
    if link_data["changeTips"] in ["always", "never"]:
        opts.append("new_tip=%s" % link_data["changeTips"])

    if link_data["disposeTips"] == "rack":
        opts.append("trash=False")

    if link_data["touchTip"] == "rack":
        opts.append("touch_tip=True")

    if link_data["blowout"]:
        opts.append("blow_out=True")

    if int(link_data["mixBefore"]["repeats"]) > 0: # TODO: type conversion?
        opts.append("mix_before=(%s, %s)" % (link_data["mixBefore"]["repeats"], link_data["mixBefore"]["volume"]))

    if int(link_data["mixAfter"]["repeats"]) > 0: # TODO: type conversion?
        opts.append("mix_after=(%s, %s)" % (link_data["mixAfter"]["repeats"], link_data["mixAfter"]["volume"]))

    if link_data["airgap"]:
        opts.append("airgap=%s" % link_data["airgap"])

    opts_str = ", ".join(opts)
    if opts_str:
        opts_str = ", " + opts_str
    return opts_str


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
