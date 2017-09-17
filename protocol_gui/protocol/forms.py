from flask_wtf import Form
from wtforms import StringField, TextAreaField, IntegerField, BooleanField
from wtforms.validators import DataRequired, EqualTo, Length

from .models import Protocol


class ProtocolForm(Form):
    """Form to create new protocol."""

    name = StringField('Name', validators=[DataRequired(), Length(min=3, max=25)])
    description = TextAreaField('Description', validators=[])
    public = BooleanField('Public')

    def __init__(self, *args, **kwargs):
        """Create instance."""
        super(ProtocolForm, self).__init__(*args, **kwargs)

    def validate(self):
        """Validate the form."""
        initial_validation = super(ProtocolForm, self).validate()
        if not initial_validation:
            return False

        return True
