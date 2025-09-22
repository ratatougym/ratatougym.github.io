# RtatouGym Documentation

This repository contains the documentation for the RtatouGym project, generated automatically via Sphinx with the awesome theme. The system extracts docstrings directly from Python code and renders them into a documentation website.

## Essential Commands

**Set the project source:**
The project source is the directory that contains the Python code to be documented. It can be set in the `conf.py` file.

**Build documentation:**
```bash
rm -rf docs/.doctrees docs/.buildinfo
sphinx-build -b html -E . docs
```

**Live development server:**
```bash
sphinx-autobuild . docs/ --port 8000
```

**Clear the cache:**
```bash
rm -rf docs/_build
```

Access the documentation at `http://localhost:8000`. The live reload feature automatically updates the website when files are modified.

## File Organization

The documentation system contains two types of files. Auto-generated files like `rtgym.rst`, `rtgym.agent.rst` are created by sphinx-apidoc from Python modules. These contain automodule directives that pull docstrings from code and get overwritten when regenerating API docs.

Customizable files include `conf.py` for configuration (themes, extensions, project settings), `index.rst` for the main landing page and navigation structure, and `modules.rst` for top-level API organization. Custom `.rst` files for tutorials and examples will not be overwritten by auto compilation.

## Advanced Operations

**Regenerate API documentation (when adding new modules):**
```bash
sphinx-apidoc -o . ../RatatouGym/rtgym --force
```

Most changes happen automatically through the live reload system when editing configuration files, content pages, or Python docstrings. Manual rebuilds are needed when adding completely new Python modules or when troubleshooting import issues.

## Customization Options

The main configuration lives in `conf.py` where themes, extensions, and build settings can be modified. The current setup uses the sphinx-awesome theme with autodoc, viewcode, and napoleon extensions for Google/NumPy style docstrings. 

**Mock imports are configured for the following dependencies** to avoid import errors during documentation generation:
- numpy, numpy.random
- matplotlib, matplotlib.pyplot
- torch
- scipy, scipy.ndimage  
- sklearn, sklearn.neighbors, sklearn.cluster
- faiss
- IPython, IPython.display

**Additional customizations:**
- Removed permalink symbols (¶) next to headings: `html_permalinks_icon = ""`
- Disabled module names in titles: `add_module_names = False`
- Enhanced autodoc options for comprehensive documentation extraction

For content customization, `index.rst` controls the main landing page structure. Additional `.rst` files for tutorials, examples, or guides can be created and included in the toctree. The `_static` folder holds custom CSS, images, and JavaScript files for styling customization.

Python docstrings become the documentation content automatically. Sphinx transforms them into a searchable, navigable website with proper formatting, cross-references, and source code links.