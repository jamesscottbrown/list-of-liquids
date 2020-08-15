# -*- coding: utf-8 -*-
"""Python 2/3 compatibility module."""
import sys

PY2 = int(sys.version[0]) == 2

if PY2:
    text_type = str  # noqa
    binary_type = str
    string_types = (str, str)  # noqa
    str = str  # noqa
    str = str  # noqa
else:
    text_type = str
    binary_type = bytes
    string_types = (str,)
    str = str
    str = (str, bytes)
