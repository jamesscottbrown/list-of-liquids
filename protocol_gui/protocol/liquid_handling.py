# We have the following objects:
# Resource - something that is initially present
# Volume
# Aliquot - a list of one-or-more (volume, resource) tuples


# Shows which resources were combined to obtain an Aliquot. This is not necessarilly the same as what the
# aliquot actually contains, as reactions may have occurred.

class Volume:
    """A volume object represents a particular volume of liquid"""

    def __init__(self, volume):
        if isinstance(volume, Volume):
            self.volume = volume.volume
        else:
            self.volume = float(volume)

    def __str__(self):
        return str(self.volume)

    def __float__(self):
        return float(self.volume)

    def get_ap_volume(self):
        return str(self.volume) + ":microliter"


class Aliquot:
    """An aliquot represents a specific volume of liquid drawn from a particular well.
    Therefore, operations that combine volumes with wells should produce an aliquot, and operations that combine a
    WellSet with Volumes should produce a list of Aliquots.
    """

    def __init__(self, resource, volume, container=False):
        self.resource = resource
        self.volume = volume
        self.container = container

    def __str__(self):
        return "Aliquot[%s of %s]" % (self.volume, self.resource)

    def short_string(self):
        if isinstance(self.resource, str) or isinstance(self.resource, str):
            return self.resource
        else:
            return self.resource.short_string()


class Resource:
    """
    A Resource is a sample or reagent that is initially present, rather than being created as the protocol is run.
    """

    def __init__(self, name="", container=False, volume=float("inf"), num_components=1):
        self.name = name
        self.num_components = num_components
        self.container = container
        self.volume = volume


class AliquotList:
    """This class exists so that we can change the behaviour of lists of aliquots.
    The default python behaviour is to treat the + operator as indicating two lists should be concatenated
    However, we want it to indicate that aliquots are combined to give a WellSet
    """

    def __init__(self, aliquots):
        self.aliquots = aliquots
        self.history = []  # WellSet, Volume
        self.times_used = ""

    def __iter__(self):
        return self.aliquots.__iter__()

    def __len__(self):
        return len(self.aliquots)

    def __getitem__(self, item):
        return self.aliquots[item]


def cross(a, b):
    res = []
    for i in range(0, len(a)):
        for j in range(0, len(b)):
            res.append(a[i] + b[j])
    return res


def process_node(protocol_obj, node_id):
    nodes = protocol_obj["nodes"]
    links = protocol_obj["links"]

    incident_links = list([l for l in links if l["target_id"] == node_id])
    node = list([n for n in nodes if n["id"] == node_id])[0]
    node_data = node["data"]

    if node["type"] == "resource":
        # return one aliquot per distinct component, with a volume that is the available volume in well
        resources = protocol_obj["resources"]
        resource_data = list([r for r in resources if r["label"] == node_data["resource"]])[0]["data"]

        num_wells = int(resource_data["num_wells"])
        if num_wells > 1:
            component_names = [node["label"] + "_" + str(i) for i in range(0, num_wells)]
        else:
            component_names = [node["label"]]

        return [[Aliquot(x, resource_data["volume"], container=resource_data["container_name"])] for x in component_names]

    elif node["type"] == "zip":

        components1 = get_constituent_aliquots(protocol_obj, incident_links[0])
        components2 = get_constituent_aliquots(protocol_obj, incident_links[1])
        return [x_y[0]+x_y[1] for x_y in zip(components1, components2)] * int(node["data"]["num_duplicates"])

    elif node["type"] == "cross":

        components1 = get_constituent_aliquots(protocol_obj, incident_links[0])
        components2 = get_constituent_aliquots(protocol_obj, incident_links[1])
        return cross(components1, components2) * int(node["data"]["num_duplicates"])

    elif node["type"] in ["aliquot", "spread", "pick"]:

        # aliquot has only one input
        components1 = get_constituent_aliquots(protocol_obj, incident_links[0])
        return components1 * int(node["data"]["num_duplicates"])

    elif node["type"] == "process":
        # process has only one input
        return get_constituent_aliquots(protocol_obj, incident_links[0])

    elif node["type"] == "pool":
        components = get_constituent_aliquots(protocol_obj, incident_links[0])

        total_volume = {}
        for component in components:
            for aliquot in component:
                if aliquot.resource not in list(total_volume.keys()):
                    total_volume[aliquot.resource] = 0

                total_volume[aliquot.resource] += aliquot.volume

        res = [[]]
        for resource in list(total_volume.keys()):
            res[0].append(Aliquot(resource, total_volume[resource]))

        return res * int(node["data"]["num_duplicates"])

    elif node["type"] == "select":
        components1 = get_constituent_aliquots(protocol_obj, incident_links[0])
        selection = node_data["selection"]

        result = []
        for component, is_elected in zip(components1, selection):
            if is_elected:
                result.append(component)

        return result * int(node["data"]["num_duplicates"])


def get_constituent_aliquots(protocol_obj, link):
    # Return a list, each element of which is the list of Aliquots corresponding to one incident link
    all_aliquots = []
    to_subtract = [] # each entry records volume (or list of volumes, one per well, taken from )

    inputs = process_node(protocol_obj, link["source_id"])

    # If an edge has the addToThis attribute set, ignore whatever is set as the transfer volume
    if link["data"]["addToThis"]:

        # subtract volume of any other transfers
        other_links_from_parent = [l for l in protocol_obj["links"] if l["source_id"] == link["source_id"] and l["target_id"] != link["target_id"]]
        for other_link in other_links_from_parent:
            to_subtract.append( str(other_link["data"]["volumes"][0]).split(',') )

        volume = "all"
    else:

        if len(link["data"]["volumes"]) > 0:
            volume = link["data"]["volumes"][0]
        else:
            volume = 0.1 # nominal volume, needed e.g. for picked colony

    input_volume_tuples = []
    if "," in str(volume):
        volumes = volume.split(',')

        if len(volumes) == len(inputs):
            input_volume_tuples = list(zip(inputs, volumes))
        elif len(inputs) == 1:
            input_volume_tuples = [(inputs[0], volume) for volume in volumes]

    else:
        for input in inputs:
            input_volume_tuples.append((input, volume))

    #
    for i in range(len(to_subtract)):
        if len(to_subtract[i]) == 1:
            to_subtract[i] = to_subtract[i] * len(input_volume_tuples)

    for i, (input, transfered_volume) in enumerate(input_volume_tuples):
        total_volume = sum([float(x.volume) for x in input])  # total volume of mixture of aliquots we are drawing from

        if transfered_volume == "all":
            transfered_volume = total_volume

            for v in to_subtract:
                transfered_volume -= float(v[i])

        transfered_volume = max(transfered_volume, 0)

        # Loop over all individual resources included on this link
        aliquot_list = []
        for i in range(0, len(input)):
            a = input[i]
            if total_volume == 0:
                aliquot_list.append(Aliquot(a.resource, 0))
            else:
                aliquot_list.append(Aliquot(a.resource, (float(transfered_volume) * float(a.volume)/total_volume)))


        all_aliquots.append(aliquot_list)

    return all_aliquots


def collapse_contents(result):
    # In some protocols, the same resource ends up being added to a well multiple times
    # (e.g. during serial dilution down a plate)
    # This function aggregates all instances of the same resource in the contents of each well.

    collapsed_result = []
    for well in result:
        total_volume = {}
        well_collapsed_contents = []
        for a in well:

            if a.resource in list(total_volume.keys()):
                total_volume[a.resource] += float(a.volume)
            else:
                total_volume[a.resource] = float(a.volume)

        for resource in total_volume:
            well_collapsed_contents.append(Aliquot(resource, total_volume[resource]))

        well_collapsed_contents.sort(key=lambda x: x.resource)
        collapsed_result.append(well_collapsed_contents)

    return collapsed_result


def format_aliquot_contents(contents):
    x = [x for x in contents if x.volume > 0]
    return ['{0:.2f}'.format(float(aliquot.volume)) + " of " + aliquot.resource for aliquot in x]
