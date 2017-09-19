from protocol_gui.protocol.liquid_handling import *
from protocol_gui.protocol.opentrons import OpenTrons
from protocol_gui.protocol.autoprotocol import AutoProtocol
from protocol_gui.protocol.english import English

from protocol_gui.protocol.models import Protocol
from protocol_gui.protocol.forms import ProtocolForm

from protocol_gui.utils import flash_errors

from flask import Blueprint, flash, redirect, render_template, request, url_for, make_response
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
def protocol_no_backslash(protocol_id):
    return redirect(url_for('protocol.protocol', protocol_id=protocol_id))


@blueprint.route('/<int:protocol_id>/')
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
    container_types.sort()

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
        form.description.data = current_protocol.description
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


@blueprint.route('/<int:protocol_id>/copy', methods=['GET', 'POST'])
@login_required
def copy_protocol(protocol_id):
    """Copy a protocol."""
    current_protocol = Protocol.query.filter_by(id=protocol_id).first()

    if current_protocol.user != current_user and not current_protocol.public:
        flash('Not your protocol!', 'danger')
        return redirect(url_for('protocol.protocol', protocol_id=protocol_id))

    new_protocol = Protocol.create(name=current_protocol.name, description=current_protocol.description,
                                   user_id=current_user.id, public=current_protocol.public,
                                   protocol=current_protocol.protocol)

    flash('New protocol created.', 'success')
    return redirect(url_for('protocol.protocol', protocol_id=new_protocol.id))

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


@blueprint.route('/<int:protocol_id>/opentrons', methods=['GET'])
def opentrons_protocol(protocol_id):
    """Get OpenTrons representation of a protocol."""

    current_protocol = Protocol.query.filter_by(id=protocol_id).first()
    if not current_protocol:
        flash('No such specification!', 'danger')
        return redirect('.')

    if current_protocol.user != current_user and not current_protocol.public:
        flash('Not your project!', 'danger')
        return redirect('.')

    if not current_protocol.protocol:
        return ""

    protocol_object = json.loads(current_protocol.protocol)

    converter = OpenTrons()

    resp = make_response(converter.convert(protocol_object, current_protocol.name))

    resp.headers['Content-Type'] = "text"
    resp.headers['Content-Disposition'] = "attachment; filename=" + current_protocol.name + "-opentrons.py"
    return resp


@blueprint.route('/<int:protocol_id>/autoprotocol', methods=['GET'])
def autoprotocol_protocol(protocol_id):
    """Get autoprotocol-python representation of a protocol."""

    current_protocol = Protocol.query.filter_by(id=protocol_id).first()
    if not current_protocol:
        flash('No such specification!', 'danger')
        return redirect('.')

    if current_protocol.public:
        print "PUBLIC"
    else:
        print "NOT PUBLIC"

    if current_protocol.user != current_user and not current_protocol.public:
        flash('Not your project!', 'danger')
        return redirect('.')

    if not current_protocol.protocol:
        return ""

    protocol_object = json.loads(current_protocol.protocol)

    converter = AutoProtocol()
    resp = make_response(converter.convert(protocol_object, current_protocol.name))
    resp.headers['Content-Type'] = "text"
    resp.headers['Content-Disposition'] = "attachment; filename=" + current_protocol.name + "-autoprotocol.py"
    return resp


@blueprint.route('/<int:protocol_id>/english', methods=['GET'])
def english_protocol(protocol_id):
    """Get autoprotocol-python representation of a protocol."""

    current_protocol = Protocol.query.filter_by(id=protocol_id).first()
    if not current_protocol:
        flash('No such specification!', 'danger')
        return redirect('.')

    if current_protocol.public:
        print "PUBLIC"
    else:
        print "NOT PUBLIC"

    if current_protocol.user != current_user and not current_protocol.public:
        flash('Not your project!', 'danger')
        return redirect('.')

    if not current_protocol.protocol:
        return ""

    protocol_object = json.loads(current_protocol.protocol)

    converter = English()
    resp = make_response(converter.convert(protocol_object, current_protocol.name))
    resp.headers['Content-Type'] = "text"
    resp.headers['Content-Disposition'] = "attachment; filename=" + current_protocol.name + "-english.md"
    return resp


@blueprint.route('/<int:protocol_id>/contents', methods=['GET', 'POST'])
def get_contents(protocol_id):
    """Determine what a given node on a protocol diagram represents."""

    current_protocol = Protocol.query.filter_by(id=protocol_id).first()
    if not current_protocol:
        flash('No such specification!', 'danger')
        return redirect('.')

    if current_protocol.user != current_user and not current_protocol.public:
        flash('Not your project!', 'danger')
        return redirect('.')

    if request.method == 'GET':
        node_id = int(request.args.get("selected_node"))
        protocol_obj = json.loads(request.args.get("protocol_string"))
    else:
        data = json.loads(request.data)
        node_id = int(data["selected_node"])
        protocol_obj = json.loads(data["protocol_string"])

    result = process_node(protocol_obj, node_id)
    result = collapse_contents(result)

    return json.dumps(map(lambda x: map(lambda y: '{0:.2f}'.format(float(y.volume)) + " of " + y.resource, x), result))


@blueprint.route('/<int:protocol_id>/checkWellsAssigned', methods=['GET', 'POST'])
def check_assigned(protocol_id):
    """Check whether all aliquots in a protocol with a container assigned have been assigned to a well."""

    current_protocol = Protocol.query.filter_by(id=protocol_id).first()
    if not current_protocol:
        flash('No such specification!', 'danger')
        return redirect('.')

    if current_protocol.user != current_user and not current_protocol.public:
        flash('Not your project!', 'danger')
        return redirect('.')

    if request.method == 'GET':
        protocol_obj = json.loads(request.args.get("protocol_string"))
    else:
        data = json.loads(request.data)
        protocol_obj = json.loads(data["protocol_string"])

    unassigned_operations = []
    unassigned_resources = []
    processed_resource_ids = set()

    for node in protocol_obj["nodes"]:

        if node["type"] == "resource":
            resource = filter(lambda x: x["label"] == node["label"], protocol_obj["resources"])[0]

            # only process the first node corresponding to each resource
            if resource["id"] in processed_resource_ids:
                continue
            processed_resource_ids.add(resource["id"])

            num_aliquots = int(resource["data"]["num_wells"])

            if "container_name" not in resource["data"].keys() or not resource["data"]["container_name"]:
                continue

            container_name = resource["data"]["container_name"]
            if node_has_unassigned_aliquots(num_aliquots, node["id"], container_name, protocol_obj):
                unassigned_resources.append(node["id"])

        else:
            if "container_name" not in node["data"].keys() or not node["data"]["container_name"]:
                continue
            container_name = node["data"]["container_name"]

            num_aliquots = len(process_node(protocol_obj, node["id"]))
            if node_has_unassigned_aliquots(num_aliquots, node["id"], container_name, protocol_obj):
                unassigned_operations.append(node["id"])

    return json.dumps({"unassigned_operations": unassigned_operations, "unassigned_resources": unassigned_resources})


def node_has_unassigned_aliquots(num_aliquots, operation_id, container_name, protocol_obj):
    container = filter(lambda x: x["name"] == container_name, protocol_obj["containers"])[0]

    aliquots_listed = set()
    for well in container["contents"]:
        for contents in container["contents"][well]:
            if contents["node_id"] == operation_id:
                aliquots_listed.add(contents["aliquot_index"])

    return len(aliquots_listed) != num_aliquots


