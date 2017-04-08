from protocol_gui.protocol.models import Protocol
from protocol_gui.protocol.forms import ProtocolForm

from protocol_gui.utils import flash_errors

from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import login_required, current_user

from urllib import unquote_plus

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

    return render_template('protocols/protocol.html', protocol=current_protocol)

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
        Protocol.create(name=form.name.data, description=form.description.data,
                        user_id=current_user.id, public=form.public.data, protocol="")
        flash('New protocol created.', 'success')
        return redirect(url_for('protocol.list_protocols'))
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

    current_protocol.protocol = unquote_plus(request.get_data())
    current_protocol.save()

    return "SUCCESS"