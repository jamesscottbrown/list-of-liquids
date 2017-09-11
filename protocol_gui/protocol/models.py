# -*- coding: utf-8 -*-
"""Protocol models."""
from protocol_gui.database import Column, Model, SurrogatePK, db, reference_col, relationship


class Protocol(SurrogatePK, Model):
    """A protocol, owned by a user."""

    __tablename__ = 'protocols'
    name = Column(db.String(250), unique=False, nullable=False)
    description = Column(db.Text, unique=False, nullable=True)
    protocol = Column(db.Text, unique=False, nullable=True)
    public = Column(db.Boolean)

    user_id = reference_col('users', nullable=True)
    user = relationship('User', backref='protocols')

    def __init__(self, name, description, protocol, public, **kwargs):
        """Create instance."""
        db.Model.__init__(self, name=name, description=description, protocol=protocol, public=public, **kwargs)

    def __repr__(self):
        """Represent instance as a unique string."""
        return '<Protocol({name}, {id})>'.format(name=self.name, id=self.id)

