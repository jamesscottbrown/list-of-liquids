# -*- coding: utf-8 -*-
"""Application assets."""
from flask_assets import Bundle, Environment

css = Bundle(
    'libs/bootstrap/dist/css/bootstrap.css',
    'css/style.css',
    filters='cssmin',
    output='public/css/common.css'
)

css_network_editor = Bundle(
	'css/network_editor.css'
)

js = Bundle(
    'libs/jQuery/dist/jquery.js',
    'libs/bootstrap/dist/js/bootstrap.js',
    'js/plugins.js',
    filters='jsmin',
    output='public/js/common.js'
)

js_network_editor = Bundle(
	'js/network_editor.js',
	'libs/cola.v3.min.js',
	'libs/d3.v3.min.js'
)

assets = Environment()

assets.register('js_all', js)
assets.register('js_network_editor', js_network_editor)
assets.register('css_all', css)
assets.register('css_network_editor', css_network_editor)