# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

import os
import sys
# Handle both local development (../rtgym) and GitHub Actions (./rtgym)
if os.path.exists(os.path.abspath('../rtgym')):
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
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store', '_theme_source', '_themes']

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

# Custom CSS files - now built into the theme, no need for overrides
html_css_files = [
    # CSS is now built into theme.css - no overrides needed!
]

# Custom JavaScript files for theme functionality
html_js_files = [
    'theme-toggle.js',
    'external-links.js',
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
