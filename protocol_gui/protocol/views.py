from protocol_gui.protocol.liquid_handling import *
from protocol_gui.protocol.models import Protocol
from protocol_gui.protocol.forms import ProtocolForm

from protocol_gui.utils import flash_errors

from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import login_required, current_user

from urllib import unquote_plus
import json

blueprint = Blueprint('protocol', __name__, url_prefix='/protocols', static_folder='../static')


@blueprint.route('/')
@login_required
def list_protocols():
    """List all user's protocol."""
    return render_template('protocols/list_protocols.html')


@blueprint.route('/<int:protocol_id>')
def protocol(protocol_id):
    """List details of a protocol."""
    current_protocol = Protocol.query.filter_by(id=protocol_id).first()

    if not current_protocol.public and current_protocol.user != current_user:
        flash('Not your protocol!', 'danger')
        return redirect('.')

    if current_protocol.protocol:
        protocol_obj = json.loads(current_protocol.protocol)
    else:
        protocol_obj = None

    # These are the container types recognised by OpenTrons
    container_types = ['tube-rack-15_50ml', 'tube-rack-2ml-9x9', '96-flat', 'point', 'tiprack-1000ul-chem',
                       '96-deep-well', 'trough-12row-short', '24-vial-rack', 'T75-flask', 'tube-rack-80well',
                       '96-well-plate-20mm', 'trough-12row', 'small_vial_rack_16x45', '5ml-3x4', '96-PCR-tall',
                       'tube-rack-5ml-96', 'trash-box', 'tiprack-1000ul', 'tiprack-10ul', 'tiprack-10ul-H',
                       '12-well-plate', 'e-gelgol', 'tube-rack-2ml', 'tube-rack-.75ml', 'MALDI-plate', 'T25-flask',
                       '48-vial-plate', 'tiprack-1000ul-H', '6-well-plate', 'rigaku-compact-crystallization-plate',
                       '384-plate', 'trough-1row-25ml', '96-PCR-flat', '24-well-plate', '48-well-plate',
                       'alum-block-pcr-strips', 'wheaton_vial_rack', 'tiprack-200ul', 'PCR-strip-tall',
                       'hampton-1ml-deep-block']

    return render_template('protocols/protocol.html', protocol=current_protocol,
                           protocol_obj=protocol_obj, container_types=container_types)

@blueprint.route('/<int:protocol_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_protocol(protocol_id):
    """Edit details of a protocol."""
    current_protocol = Protocol.query.filter_by(id=protocol_id).first()

    if current_protocol.user != current_user:
        flash('Not your protocol!', 'danger')
        return redirect('.')

    form = ProtocolForm(request.form)
    if form.validate_on_submit():
        form.populate_obj(current_protocol)
        current_protocol.save()
        flash('Protocol updated.', 'success')
        return redirect('protocols/' + str(protocol_id))
    else:
        flash_errors(form)
    return render_template('protocols/edit_protocol.html', form=form, current_protocol=current_protocol)


@blueprint.route('/<int:protocol_id>/delete', methods=['GET', 'POST'])
@login_required
def delete_protocol(protocol_id):
    """Delete a protocol."""
    current_protocol = Protocol.query.filter_by(id=protocol_id).first()

    if current_protocol.user != current_user:
        flash('Not your protocol!', 'danger')
        return redirect('.')

    if request.method == "POST":
        current_protocol.delete()
        return redirect(url_for('protocol.list_protocols'))

    return render_template('protocols/delete_protocol.html', current_protocol=current_protocol)


@blueprint.route('/add', methods=['GET', 'POST'])
@login_required
def new_protocol():
    """Add new protocol."""
    form = ProtocolForm(request.form)
    if form.validate_on_submit():
        new_protocol = Protocol.create(name=form.name.data, description=form.description.data,
                        user_id=current_user.id, public=form.public.data, protocol="")
        flash('New protocol created.', 'success')
        return redirect(url_for('protocol.protocol', protocol_id=new_protocol.id))
    else:
        flash_errors(form)
    return render_template('protocols/new_protocol.html', form=form)



@blueprint.route('/<int:protocol_id>/save', methods=['POST'])
@login_required
def save_protocol(protocol_id):
    """Update stored string-representation of a protocol."""

    current_protocol = Protocol.query.filter_by(id=protocol_id).first()
    if not current_protocol:
        flash('No such specification!', 'danger')
        return redirect('.')

    if current_protocol.user != current_user:
        flash('Not your project!', 'danger')
        return redirect('.')

    current_protocol.protocol = unquote_plus(request.get_data()).decode('utf-8')
    current_protocol.save()

    return "SUCCESS"

@blueprint.route('/<int:protocol_id>/contents', methods=['GET'])
@login_required
def get_contents(protocol_id):
    """Determine what a given node on a protocol diagram represents."""

    current_protocol = Protocol.query.filter_by(id=protocol_id).first()
    if not current_protocol:
        flash('No such specification!', 'danger')
        return redirect('.')

    if current_protocol.user != current_user:
        flash('Not your project!', 'danger')
        return redirect('.')

    node_id = int(request.args.get("selected_node"))
    protocol_obj = json.loads(request.args.get("protocol_string"))

    result = process_node(protocol_obj, node_id)
    return json.dumps( map(lambda x: map(lambda y: str(y.volume) + " of " + y.resource, x), result) )


def process_node(protocol_obj, node_id):
    nodes = protocol_obj["nodes"]
    links = protocol_obj["links"]

    incident_links = list(filter(lambda l: l["target_id"] == node_id, links))
    node = list(filter(lambda n: n["id"] == node_id, nodes))[0]
    node_data = node["data"]

    # print incident_links, node

    if node["type"] == "well":
        # return one aliquot per distinct component, with a volume that is the available volume in well
        component_names = [node["label"] + "_" + str(i) for i in range(0, int(node_data["num_wells"]))]
        return map(lambda x: [Aliquot(x, node_data["volume"], container=node_data["container_name"])], component_names)

    elif node["type"] == "zip":

        components1 = get_constituent_aliquots(protocol_obj, incident_links[0])
        components2 = get_constituent_aliquots(protocol_obj, incident_links[1])
        return map(lambda(x,y): x+y, zip(components1, components2))

    elif node["type"] == "cross":

        components1 = get_constituent_aliquots(protocol_obj, incident_links[0])
        components2 = get_constituent_aliquots(protocol_obj, incident_links[1])
        return cross(components1, components2)

    elif node["type"] == "aliquot":

        # aliquot has only one input
        components1 = get_constituent_aliquots(protocol_obj, incident_links[0])
        return components1 * int(incident_links[0]["data"]["num_duplicates"])

    elif node["type"] == "process":
        pass

    elif node["type"] == "pool":
        pass

    elif node["type"] == "select":
        components1 = get_constituent_aliquots(protocol_obj, incident_links[0])
        selection = node_data["selection"]

        result = []
        for component, is_elected in zip(components1, selection):
            if is_elected:
                result.append(component)

        return result


def get_constituent_aliquots(protocol_obj, link):
    # Return a list, each element of which is the list of Aliquots corresponding to one incident link
    all_aliquots = []

    inputs = process_node(protocol_obj, link["source_id"])

    volumes = link["data"]["volumes"]
    if len(volumes) == 1:
        volumes *= len(inputs)
    elif len(volumes) != len(inputs):
        print "Error: number of volumes (%s) and aliquots (%s) do not match" % (len(volumes), len(inputs))

    # each input corresponds to a link on the diagram
    for (input, transfered_volume) in zip(inputs, volumes):
        total_volume = sum(map(lambda x: float(x.volume), input))  # total volume of mixture of aliquots we are drawing from

        # Loop over all individual resources included on this link
        aliquot_list = []
        for i in range(0, len(input)):
            a = input[i]
            aliquot_list.append(Aliquot(a.resource, (transfered_volume * float(a.volume)/total_volume)))

        all_aliquots.append(aliquot_list)

    return all_aliquots

