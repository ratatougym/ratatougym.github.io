# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

import os
import sys
# Handle both local development (../rtgym) and GitHub Actions (./rtgym)
if os.environ.get('RTGYM_SOURCE'):
    sys.path.insert(0, os.path.abspath(os.environ['RTGYM_SOURCE']))
elif os.path.exists(os.path.abspath('../rtgym')):
    sys.path.insert(0, os.path.abspath('../rtgym'))
elif os.path.exists(os.path.abspath('./rtgym')):
    sys.path.insert(0, os.path.abspath('./rtgym'))
else:
    print("Warning: rtgym path not found")

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = 'RatatouGym'
copyright = '2025, Zhaoze Wang @ Balasubramanian Lab'
author = 'Zhaoze Wang'
release = '1.0.0'

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = [
    'sphinx.ext.autodoc',
    'sphinx.ext.viewcode',
    'sphinx.ext.napoleon',
    'sphinx.ext.mathjax',
]

# Mock imports for modules that are not available during documentation generation
autodoc_mock_imports = [
    'numpy', 'numpy.random', 'matplotlib', 'torch', 'matplotlib.pyplot', 'scipy', 
    'scipy.ndimage', 'sklearn', 'sklearn.neighbors', 'sklearn.cluster', 
    'faiss', 'IPython', 'IPython.display'
]

templates_path = ['_templates']
exclude_patterns = [
    '_build', 'docs', 'Thumbs.db', '.DS_Store', '_theme_source', '_themes', '.venv',
    '.source', 'tests', '**/room-gallery', '**/scene-demo', '**/build-cache.json',
]

language = 'en'

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

# Use custom theme with your CSS built into theme.css
html_theme = 'ratatougym_custom'
html_theme_path = ['_themes']

html_static_path = ['_static']

# Theme configuration for clean customization
html_theme_options = {
    # Sidebar configuration
    'sidebar_width': '200px',
    'sidebar_fixed': True,

    # Navigation styling
    'nav_links': [],

    # Custom CSS variables (this is the clean way to customize)
    'extra_header_link_icons': {},
}

# The presentation layer shares the welcome page's branding. RST and autodoc stay unchanged.
html_css_files = ['scene-docs.css']

# Custom JavaScript files for theme functionality
html_js_files = [
    'external-links.js',
    ('vendor/lucide.min.js', {'defer': 'defer'}),
    ('scene-docs.js', {'defer': 'defer'}),
]

# Sidebar configuration to maintain consistent navigation
html_sidebars = {
    '**': ['globaltoc.html'],
}

# Favicon configuration
html_favicon = '_static/cheese.ico'

# Theme options to clean up rendering
html_theme_options = {
    'show_prev_next': False,
    'awesome_external_links': True,
}

# Fix for section headers
html_show_sourcelink = False

# Remove the ¶ symbols next to headings
html_permalinks_icon = ""

# Autodoc settings to control title generation
autodoc_default_options = {
    'members': True,
    'undoc-members': True,
    'show-inheritance': True,
    # 'special-members': '__init__',
    'exclude-members': '__weakref__'
}

# Don't add "package" to titles
add_module_names = False


def scene_homepage(app, pagename, templatename, context, doctree):
    if pagename == 'index':
        return 'scene-home.html'


def require_scene_bundle(app):
    import json
    from pathlib import Path
    from sphinx.errors import ConfigError

    if app.builder.format != 'html':
        return
    static = Path(app.confdir) / '_static'
    bundle = static / 'scene-clips'
    try:
        rooms = json.loads((bundle / 'index.json').read_text())['rooms']
        if len(rooms) != 36 or len({room['id'] for room in rooms}) != 36:
            raise ValueError('Expected 36 distinct homepage rooms')
        for room in rooms:
            for key in ('video', 'poster', 'hd_video'):
                asset = (bundle / room[key]).resolve()
                if not asset.is_relative_to(bundle.resolve()) or not asset.is_file():
                    raise ValueError(f'Missing or invalid homepage asset: {room[key]}')
        for name in ('vendor/lucide.min.js', 'vendor/LUCIDE-LICENSE.txt'):
            if not (static / name).is_file():
                raise ValueError(f'Missing icon dependency: {name}')
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise ConfigError(f'Incomplete homepage bundle: {error}') from error


def setup(app):
    app.connect('builder-inited', require_scene_bundle)
    app.connect('html-page-context', scene_homepage)
