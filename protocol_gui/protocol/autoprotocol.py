from protocol_gui.protocol.converter import Converter

class AutoProtocol(Converter):

    def get_header(self, protocol, protocol_name):

        protocol_str = "from autoprotocol.util import make_dottable_dict\n\n"
        protocol_str += "def %s(protocol, params):\n\n" % protocol_name
        return protocol_str


    def get_footer(self, protocol_name):
        return """
if __name__ == '__main__':
    from autoprotocol.harness import run
    run(%s, '%s')
            """ % (protocol_name, protocol_name)

    def get_consolidate_string(self, pipette_name, volume_one, container_one, source_str, container_target, target, options_str):
        return "    protocol.consolidate(%s, %s.wells(%s), %s.well('%s')%s)\n" % (volume_one, container_one, source_str, container_target, target, options_str)

    def get_transfer_string(self, pipette_name, volume, container, source_row, container_target, result_row, options_str):
        return "    protocol.transfer(%s, %s.rows('%s'), %s.rows('%s')%s)\n" % (
            volume, container, source_row, container_target, result_row, options_str)

    def get_transfer_well_string(self, pipette_name, volume, container, source_well, container_target, result_well, options_str):
        return "    protocol.transfer(%s, %s.well('%s'), %s.well('%s')%s)\n" % (
            volume, container, source_well, container_target, result_well, options_str)

    def get_distribute_string(self, pipette_name, volume, container, source, container_target, targets_str, options_str):
        return "    protocol.distribute(%s, %s.well('%s'), %s.wells(%s)%s)\n" % (volume, container, source, container_target, targets_str, options_str)
