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
        if isinstance(self.resource, str) or isinstance(self.resource, unicode):
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


def cross(a,b):
    res = []
    for i in range(0, len(a)):
        for j in range(0, len(b)):
            res.append(a[i] + b[j])
    return res
