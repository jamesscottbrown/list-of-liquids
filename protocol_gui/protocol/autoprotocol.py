from protocol_gui.protocol.converter import Converter
import re

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

    def get_pick_string(self, container, source_wells, container_target, target_wells, min_colonies):
        return "    protocol.autopick(%s.wells(%s), %s.wells(%s), min_abort=%s)\n" % (container, source_wells, container_target, target_wells, min_colonies)

    def get_spread_string(self, container, source_wells, container_target, target_wells, volume):
        return "    protocol.spread(%s.wells(%s), %s.wells(%s), %s)\n" % (container, source_wells, container_target, target_wells, volume)

    def get_process_string(self, node_data, options, well_locations):
        operation_type = node_data["process_type"]
        container = node_data["container_name"]

        wells = "%s.wells(%s)" % (container, well_locations)

        if operation_type == "spin":
            return "    protocol.spin(%s, %s, %s, flow_direction=None, spin_direction=None)\n" % (container, options["acceleration"], options["duration"])

        elif operation_type == "cover":
            return "    protocol.cover(%s, lid=%s)\n" % (container, options["lid_type"])

        elif operation_type == "seal":
            return "    protocol.seal(%s, type=None)\n" % (container)

        elif operation_type == "unseal":
            return "    protocol.unseal(%s)\n" % (container)

        elif operation_type == "incubate":
            return "    protocol.incubate(%s, %s, %s, shaking=False, co2=0, uncovered=False)" % (container, options["where"], options["duration"])

        elif operation_type == "thermocycle":
            # TODO: FIXME
            groups = convert_schedule(options["schedule"])
            return "    protocol.thermocycle(%s, %s, volume=%s, dataref=None, dyes=None, melting_start=None, melting_end=None, melting_increment=None, melting_rate=None)\n" % (container, groups, options["volume"])

        elif operation_type == "absorbance":
            return "    protocol.absorbance(%s, %s, %s, %s, flashes=%s, incubate_before=None, temperature=None)" % \
                   (container, wells, options["wavelength"], options["dataref"], options["num_flashes"])

        elif operation_type == "luminescence":
            return "    protocol.luminescence(%s, %s, incubate_before=None, temperature=None)" % \
                   (container, wells, options["dataref"])

        elif operation_type == "gel_separate":
            return "    protocol.gel_separate(%s.wells(%s), %s, %s, %s, %s, dataref)" % \
                   (container, wells, options["volume"], options["matrix"], options["ladder"], options["duration"], options["dataref"])
            # WHY no container reference?

        elif operation_type == "fluorescence":
            return "    protocol.fluorescence(%s, %s, %s, %s, %s, flashes=%s, temperature=%s, gain=None, incubate_before=None)" % \
                   (container, options["wells"], options["excitation"], options["emission"], options["dataref"], options["num_flashes"], options["temperature"])

        else:
            return "    # FIXME: operation '" + operation_type + "' not implemented for AutoProtocol"

def convert_schedule(schedule_string):

    # Convert a schedule like " 3 times (12C for 5 min, 13C for 5 min), 6 times (20C for 2 min, 8C for 6 min)"
    # Into an object like:
    #[{ "cycles": 3,
    #   "steps": [{"duration": "5:minute", "temperature": "12:celcius"}, {"duration": "5:minute", "temperature": "13:celcius"}]
    #  },{
    #    "cycles": 6,
    #    "steps": [{"duration": "2:minute", "temperature": "20:celcius"}, { "duration": "6:minute)", "temperature": "8:celcius"}]
    #}]

    groups = []

    for group_string in schedule_string.split("),"): # can't split on just '',' as this appears within parens
        m = re.search('(\d.+?).+?\((.+)\)?', group_string.strip())

        num_repeats = int(m.group(0)[0])

        steps = []
        print "m.groups is ", m.groups()
        for step_string in m.groups(0)[1].split(","):
            print "step_string is", step_string
            (temperature, duration) = step_string.split(" for ")
            temperature = temperature.strip()[0:-1] + ":celcius"

            duration = duration.strip().replace(' ', ':').lower()
            duration = duration.replace('s', 'second').replace('min', 'minute').replace('h', 'hour')
            steps.append({"temperature": temperature, "duration": duration})

        groups.append({"cycles": num_repeats, "steps": steps})
    return groups