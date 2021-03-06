# TODO:
# automatic pipette assignment
# what if names of pipeetes/containers include spaces or other forbidden characters?
# other operations - e.g. select, incubate, etc.

# multi-channel transfer
from protocol_gui.protocol.converter import Converter


class OpenTrons(Converter):

    def get_header(self, protocol, protocol_name, protocol_description):

        self.pipette_name = protocol["pipettes"][0]["name"]
        opentrons_protocol = "# This protocol was exported from List of Liquids\n"
        opentrons_protocol += "# " + protocol_description.replace("\n", "\n#") + "\n\n"

        opentrons_protocol += "from opentrons import containers, instruments\n\n"

        for container in protocol["containers"]:
            opentrons_protocol += '%s = containers.load("%s", "%s")\n' \
                                  % (self.sanitise_name(container["name"]), container["type"], container["location"])
        opentrons_protocol += "\n"

        for pipette in protocol["pipettes"]:
            opentrons_protocol += """%s = instruments.Pipette(axis="%s",
        max_volume="%s",
        min_volume="%s",
        channels="%s",
        aspirate_speed="%s",
        dispense_speed="%s",
        tip_racks=[%s],
        trash_container=%s,
        name="%s")\n\n""" \
            % (self.sanitise_name(pipette["name"]), pipette["axis"], pipette["volume"], pipette["min_volume"],  pipette["channels"],
               pipette["aspirateSpeed"], pipette["dispenseSpeed"], self.sanitise_name(pipette["tipracks"]), self.sanitise_name(pipette["trash"]), pipette["name"])

        opentrons_protocol += "\n"
        return opentrons_protocol

    @staticmethod
    def get_options(link_data):
        opts = []

        # new_tip should be "always" or "never"
        if link_data["changeTips"] in ["always", "never"]:
            opts.append("new_tip='%s'" % link_data["changeTips"])

        if link_data["disposeTips"] == "rack":
            opts.append("trash=False")

        if link_data["touchTip"] == "rack":
            opts.append("touch_tip=True")

        if link_data["blowout"]:
            opts.append("blow_out=True")

        if int(link_data["mixBefore"]["repeats"]) > 0:  # TODO: type conversion?
            opts.append("mix_before=(%s, %s)" % (link_data["mixBefore"]["repeats"], link_data["mixBefore"]["volume"]))

        if int(link_data["mixAfter"]["repeats"]) > 0:  # TODO: type conversion?
            opts.append("mix_after=(%s, %s)" % (link_data["mixAfter"]["repeats"], link_data["mixAfter"]["volume"]))

        if link_data["airgap"]:
            opts.append("airgap=%s" % link_data["airgap"])

        opts_str = ", ".join(opts)
        if opts_str:
            opts_str = ", " + opts_str
        return opts_str

    def get_consolidate_string(self, pipette_name, volume_one, container_one, source_str, container_target, target, options_str):
        return "%s.consolidate(%s, %s.wells(%s), %s.well('%s')%s)\n" % (pipette_name, volume_one, container_one, source_str, container_target, target, options_str)

    def get_transfer_string(self, pipette_name, volume, container, source_row, container_target, result_row, options_str, target_container_cols):
        return "%s.transfer(%s, %s.rows('%s'), %s.rows('%s')%s)\n" % (
            pipette_name, volume, container, source_row, container_target, result_row, options_str)

    def get_transfer_well_string(self, pipette_name, volume, container, source_well, container_target, result_well, options_str):
        return "%s.transfer(%s, %s.well('%s'), %s.well('%s')%s)\n" % (
            pipette_name, volume, container, source_well, container_target, result_well, options_str)

    def get_distribute_string(self, pipette_name, volume, container, source, container_target, targets_str, options_str):
        return "%s.distribute(%s, %s.well('%s'), %s.wells(%s)%s)\n" % (pipette_name, volume, container, source, container_target, targets_str, options_str)

    def get_process_string(self, node_data, options, well_locations):
        operation_type = node_data["process_type"]

        if operation_type == "wait":
            return self.pipette_name + ".delay(seconds=" + str(options["duration"]) + ")\n"
        elif operation_type == "magdeck_on":
            return "mag_deck.engage()\n"
        elif operation_type == "magdeck_off":
            return "mag_deck.disengage()\n"
        else:
            return "# FIXME: operation '" + operation_type + "' not implemented for OpenTrons"

    def get_pick_string(self, container, source_wells, container_target, target_wells, min_colonies):
        return "# Colony picking operations are not supported in OpenTrons \n"

    def get_spread_string(self, container, source_wells, container_target, target_wells, volume):
        return "# Spreading operations are not supported in OpenTrons \n"
