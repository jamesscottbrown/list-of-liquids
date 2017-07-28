class Converter:
    def __init__(self):
        pass

    def convert(self, protocol, protocol_name):
        protocol_str = self.get_header(protocol, protocol_name)

        # do a topological sort on the operations graph; then convert each operation to a stamp or pipette
        operation_nodes = filter(lambda x: x["type"] in ["zip", "cross", "process", "pool", "aliquot", "select"],
                                 protocol["nodes"])
        processed_nodes = filter(lambda x: x["type"] == "well", protocol["nodes"])

        while len(operation_nodes) > 0:
            for node in operation_nodes:

                has_unprocessed_parents = False
                parentIDs = node["parentIds"]
                for pid in parentIDs:
                    if not filter(lambda x: x["id"] == pid, processed_nodes):
                        has_unprocessed_parents = True

                if not has_unprocessed_parents:
                    protocol_str += self.process_node(node, protocol)
                    processed_nodes.append(node)
                    operation_nodes.remove(node)

        return protocol_str


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

    @staticmethod
    def get_locations(protocol, node):
        container = filter(lambda x: x["name"] == node["data"]["container_name"], protocol["containers"])[0]

        locations = []
        for well_address in container["contents"]:

            for contents in container["contents"][well_address]:
                aliquot_index = int(contents["aliquot_index"])

                print "node:", node
                if int(contents["operation_index"]) == int(node["id"]):
                    while aliquot_index + 1 > len(locations):
                        locations.append(None)

                    locations[aliquot_index] = well_address

        return locations
