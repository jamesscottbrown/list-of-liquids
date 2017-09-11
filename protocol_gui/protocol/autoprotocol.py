from protocol_gui.protocol.converter import Converter

class AutoProtocol(Converter):

    def get_header(self, protocol, protocol_name):

        protocol_str = "from autoprotocol.util import make_dottable_dict\n\n"
        protocol_str += "def %s(protocol, params):\n\n" % protocol_name
        return protocol_str


    @staticmethod
    def get_options(link_data):
        # TODO: we do not provide all possible Autoprotocol options
        opts = []

        # new_tip should be "always" or "never"
        if link_data["changeTips"] == "always":
            opts.append("allow_carryover=False")
        elif link_data["changeTips"] == "never":
            opts.append("allow_carryover=True")


        # Unlike in OpenTrons, mixBefore/After use same options
        mix_options = []
        if int(link_data["mixBefore"]["repeats"]) > 0:
            opts.append("mix_before=True")

            mix_options.append("mix_vol='%s:microliter'" % link_data["mixBefore"]["volume"])
            mix_options.append("repetitions=%s" % link_data["mixBefore"]["repeats"])

        if int(link_data["mixAfter"]["repeats"]) > 0:
            opts.append("mix_after=True")

            mix_options = []
            mix_options.append("mix_vol='%s:microliter'" % link_data["mixAfter"]["volume"])
            mix_options.append("repetitions=%s" % link_data["mixAfter"]["repeats"])

        if mix_options:
            opts.extend(mix_options)

        opts_str = ", ".join(opts)
        if opts_str:
            opts_str = ", " + opts_str
        return opts_str

    def get_footer(self, protocol_name):
        return """
if __name__ == '__main__':
    from autoprotocol.harness import run
    run(%s, '%s')
            """ % (protocol_name, protocol_name)

    @staticmethod
    def sanitise_name(name):
        name = name.replace(' ', '_')
        name = name.replace('-', '_')
        return name

    def get_consolidate_string(self, pipette_name, volume, container_one, source_str, container_target, target, options_str):
        return "    protocol.consolidate(%s.wells(%s), %s.well('%s'), '%s:microliter'%s)\n" % (container_one, source_str, container_target, target, volume, options_str)

    def get_transfer_string(self, pipette_name, volume, container, source_row, container_target, result_row, options_str):
        return "    protocol.transfer(%s.rows('%s'), %s.rows('%s'), '%s:microliter'%s)\n" % (
             container, source_row, container_target, result_row, volume, options_str)

    def get_transfer_well_string(self, pipette_name, volume, container, source_well, container_target, result_well, options_str):
        return "    protocol.transfer(%s.well('%s'), %s.well('%s'), '%s:microliter'%s)\n" % (
            container, source_well, container_target, result_well, volume, options_str)

    def get_distribute_string(self, pipette_name, volume, container, source, container_target, targets_str, options_str):
        return "    protocol.distribute(%s.well('%s'), %s.wells(%s), '%s:microliter'%s)\n" % (container, source, container_target, targets_str, volume, options_str)
