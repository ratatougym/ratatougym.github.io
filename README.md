# RtatouGym Documentation

## Scene Homepage

The desktop homepage has a top navigation bar, a RatatouGym introduction on the
left, and a fixed 6x6 grid of all 36 actual Isaac-rendered room cutaways on the
right. Narrow screens stack the introduction above the grid. The subtitle is:
"A simulation environment for neuroscience and embodied AI that directly models
sensory encodings for ultra-fast simulation."
Every cell plays a separate muted MP4 loop, with no buttons, modal,
playback controls, or room labels. The grid stays six columns by six rows on
mobile, shrinking to keep every scene inside the viewport. Videos are encoded
directly from all 720 original rendered PNGs per room, not the previously
downsampled MP4. Each is 256x160, 36 fps, H.264, 20 seconds per loop: 6x the
original 120-second orbit speed. Every original render frame is retained; no
frame-dropping fps filter, duplicated frames, or interpolation is used.
All 36 small videos total 5.69 MB, versus 248.01 MB of full-size source videos.
The homepage never requests the full-size orbits or interior photos. It fetches
every complete MP4 as a Blob, then waits for all 36 first frames to decode before
starting any player. `preload` or `canplaythrough` alone is not the download gate.
Videos share a monotonic clock. Normal drift is corrected through gentle
playback-rate adjustments (0.97 to 1.03), without seeking or disrupting decoding.
Only a major stall of over 0.5 seconds triggers a recovery seek. A hidden tab freezes the entire
group; returning resumes every video from the shared phase. A tab hidden during
loading does not start playback when downloads finish. Clicking cannot pause
individual players. Encoding uses CPU only, not Isaac or the GPU.
The styling is cool white and graphite, with a restrained teal brand accent.

Mouse hover snaps an enlarged video to a complete 3x3 block centered on the
room, including internal gutters, so no partially covered video edges remain. All other cells
and grid tracks stay fixed: no reflow, compression, or extra gaps. Edge rooms
expand inward. The video fills the block without stretching (a slight crop
accounts for the gutter). Moving away restores the original cell.
After all 36 small videos download and decode, two background workers preload
the 800x500 HD clips. Hover shares an existing download or starts a prioritized
request for an unqueued room, without fetching the same file twice. HD is aligned
to the shared rotation phase before replacing the visible low-resolution video.
The low-resolution player stays active underneath. Previously downloaded clips
wait for a decoded HD frame before expanding, avoiding a low-resolution flash;
HD also remains visible through the closing animation. Downloaded HD Blobs stay
cached for the page lifetime (up to 64.76 MB). Only the active hover and briefly
retiring transitions have HD decoders. Mouse leave cancels the hover presentation,
not the shared download; navigating away cancels outstanding downloads. Touch
pointer movement does not trigger hover. HD also retains all 720 frames at 36 fps,
20 seconds per loop. The background HD preload totals 64.76 MB.

The complete orbit-and-six-photo gallery remains internal at the original
standalone gallery server. It is excluded from public builds.
The previous homepage content, citations, and documentation navigation are
retained in `overview.rst`. Documentation pages share the homepage's typography,
cheese logo, cool-gray background, and navigation, while remaining accessible at
their existing URLs. The homepage navigation links
to Documentation, Get started, API, and the RatatouGym source code repository.

Publication of the interactive homepage and documentation was approved on
2026-09-14. The public media bundle contains only 36 small videos, 36 matching HD
videos, 36 WebP posters, and their index. Original renders, USD/GLB assets, the
full internal gallery, and encoding caches are not published. An HTML build
without all homepage assets fails instead of producing broken video cells.

From the remi-scene checkout, export into a new or empty destination:

```bash
python3 scripts/export_room_gallery_bundle.py \
  --output ../ratatougym.github.io/_static/room-gallery
python3 scripts/build_home_clips.py --hd \
  --output ../ratatougym.github.io/_static/scene-clips
```

The exporter requires all 36 rooms and 216 photos to be ready. It includes only
WebP photos, MP4 videos, the browser code, and Lucide with its license; no USD,
GLB, source PNG links, machine paths, or render metadata. Current size is about
289 MB for the full detailed gallery. The homepage uses its separate 5.69 MB
small-video bundle, plus small posters. Neither script uploads anything. Use a
fresh directory for a later detailed-gallery snapshot; the small-clip builder
can resume using render metadata, frame fingerprints, and encoding settings. Do not hand-edit generated
files. The detailed gallery's canonical frontend remains in remi-scene until
the projects are merged.

`build_home_clips.py` requires FFmpeg with libx264/libwebp and ffprobe. Its
`--frames` option defaults to `outputs/room-turntables` in remi-scene. It requires
every numbered PNG from 0000 through 0719 and validates the encoded frame count
(720), dimensions, frame rate (36), and duration (20 seconds) before making a
clip available. Missing frames fail the build instead of shortening a loop.
`--hd` additionally creates the matching native-resolution hover clips without
re-encoding already-current small clips.
MP4 has fast-start metadata and broad browser compatibility. In an earlier
60-second, same-resolution comparison, the first room was 278,887 bytes as
MP4 versus 8,574,852 bytes as GIF; GIF is not used on the homepage.

Build and preview from this checkout:

```bash
RTGYM_SOURCE=../ratatougym sphinx-build -b html -E . _build/html
python3 -m http.server 8811 --bind 127.0.0.1 --directory _build/html
```

`RTGYM_SOURCE` selects the Python checkout used by autodoc; omit it to use the
existing default lookup. The local source currently has pre-existing docstring,
missing-module, and cross-reference warnings unrelated to the scene homepage.

`index.rst` selects the homepage, and `overview.rst` preserves the old landing
content. Asset URLs resolve relative to each script, so the bundle works at the
site root or a subpath. This page integration is not a merge of the scene
generator and simulator APIs. Underlying third-party asset licenses still apply;
the website does not distribute their source meshes or textures.

## Publishing And Source Updates

`.github/workflows/docs.yml` checks out `ratatougym/ratatougym` at `main`, runs
`sphinx-apidoc` to refresh generated API directives, and compiles the docstrings
with the pinned Sphinx version in `requirements-docs.txt`. Handwritten guides,
the overview, and the homepage are not overwritten by API generation.

Merge and push simulator changes to its `main` before triggering this workflow.
Website `main` pushes deploy automatically; manual runs and `source-updated`
repository dispatches also rebuild. Pull requests build but never deploy.
Pushing only to the simulator repository does not trigger a website build; use:

```bash
gh workflow run docs.yml --repo ratatougym/ratatougym.github.io --ref main
```

Each deployment writes `build-info.json` with the exact simulator commit used.
`scripts/verify_site.py` checks newly merged API anchors, all 36 complete video
sets, and the absence of internal scene files before the Pages artifact uploads.
To reproduce the public build locally, use a fresh output directory:

```bash
python -m pip install -r requirements-docs.txt
sphinx-apidoc --force --no-toc -o . ../ratatougym/rtgym
RTGYM_SOURCE=../ratatougym sphinx-build -b html -E -d _build/doctrees . _build/release
python scripts/verify_site.py _build/release --source ../ratatougym
```

This repository contains the documentation for the RtatouGym project, generated automatically via Sphinx with the awesome theme. The system extracts docstrings directly from Python code and renders them into a documentation website.

## Shared Documentation Presentation

The root `index.html` uses the interactive scene homepage. Documentation begins
at `overview.html`; tutorials and API pages retain their existing paths. Shared
branding lives in `_static/site-brand.css` and `_templates/site-nav.html`.
`_static/scene-docs.css`, `_static/scene-docs.js`, and the documentation templates
provide the new presentation over Sphinx's existing content generation. The old
theme stylesheet is excluded; its Python extension and Sphinx's search, index,
syntax highlighting, source links, and math support remain available.

No documentation RST content or Python docstrings were changed for the restyle.
The subsequent source-main release refreshes the generated `rtgym*.rst` API
directives to include new modules and remove the renamed sensory module path;
handwritten documentation remains unchanged.
Autodoc and Napoleon still generate API content from the Python checkout selected
by `RTGYM_SOURCE`. Mobile navigation, document search, and code copying remain
available, and documentation pages do not download scene videos.

Run the isolated docstring-update regression from this checkout:

```bash
python3 -m unittest discover -s tests -p 'test_docstring_build.py'
```

It uses the real configuration and templates in a temporary fixture, changes a
fixture-only Python docstring, rebuilds, and checks that the documentation updates
while the root remains the interactive homepage. Browser checks in remi-scene's
`world_viewer/tests/docs-theme-check.mjs` compare all 16 documentation sources,
rendered text, anchors, and body links with a pre-restyle snapshot, then exercise
desktop/mobile navigation, search, source pages, and clipboard copying.

Use a fresh HTML output directory when changing the source-view theme: Sphinx
viewcode can retain an existing source page if the Python source file is older
than its generated HTML, even with `-E`.

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
RTGYM_SOURCE=../ratatougym sphinx-autobuild . _build/live --port 8000 \
  --watch ../ratatougym/rtgym
```

The extra watch directory includes Python docstring edits outside this website
checkout. This server is separate from the existing static preview on port 8811.

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
