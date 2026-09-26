# RtatouGym Documentation

## Scene Homepage

The desktop homepage opens with a top navigation bar, a RatatouGym introduction on the
left, and a fixed 6x6 grid of all 36 actual Isaac-rendered room cutaways on the
right. Narrow screens stack the introduction above the grid. The introduction
connects spatial navigation, sensory experience, neural responses, and rendered
environments. The page scrolls normally; documentation remains a separate page.
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
Gallery videos pause when the gallery is offscreen. They share a monotonic clock.
Normal drift is corrected through gentle
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
accounts for the gutter). Crossing a gutter preserves the current enlarged room
and its HD decoder; entering another room switches the selection. Leaving the
gallery returns to the default room.

The default room's HD clip downloads before the thumbnails. The loading overlay
stays visible until all 36 small videos decode and the default room presents its
first HD frame. Two background workers then preload the remaining HD clips.
Hover shares an existing download or starts a prioritized
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

The sensory simulation section contains three subsections. Its overall title is
currently omitted; the first subsection has a “Trajectory Simulation” heading
above the text to the right of the figures.

- Trajectory simulation: recorded planar paths in connected rooms and a 3D flight
  through a four-room layout, with the explanation to their right. These shaded animations
  use actual trajectories from `grasp-lyrl/grid_and_place`, revision
  `c00a4c4ad33983a5d64c7fffa3eb3ea7ced36b6c`. The 3D occupancy volume has a floor,
  ceiling, walls and doorways. The 3D rendering hides the ceiling and two foreground
  exterior walls. Rear walls are opaque white; interior walls alone are semi-transparent.
  All visible walls retain their full height and doorways.
  The planar example retains its opaque cutaway walls. Simulation geometry is unchanged.
  Blue trajectories are rendered at 960 × 720, 30 fps, with four-times playback
  speed and a recent trail. The browser plays H.264 videos only while visible,
  pauses them when the tab is hidden, and retains still posters for reduced motion.
- Sensory encoding simulation: an automatic example samples vision-like response
  fields along a recorded trajectory and displays recent encoding vectors. Both
  views use the same clock and response data as the interactive demo, with their
  own playback position. Playback pauses offscreen.
- Interactive demo: a room, stacked response fields, recent encoding vectors,
  and a synchronized 3D projection of sensor responses. Vision uses synthetic WeakSMCell fields,
  optionally multiplied by wrapped Gaussian heading tuning. Sensor toggles also add
  position (place cells), spatial metric (grid cells), heading (head-direction cells),
  and boundaries (boundary cells). The room has baked lighting and no response-map overlays;
  the right-hand point cloud uses all 24 cells per family. No playback controls.
  The 205-second recorded trajectory loops at 4x (about 51 seconds) and pauses offscreen.

The navigation JSON files retain the source revision, control-code hash, seeds,
selected agent, excerpt start, native coordinates and wall footprints. Export checks
intermediate points along every recorded segment against the occupancy map. It
selects a continuous excerpt without modifying the recorded path. Regenerate with:

```bash
RTGYM_DISABLE_COMPILE=1 ../ratatougym/.venv/bin/python scripts/export_navigation_examples.py \
  --source ../grid_and_place --output _static/demos/navigation
blender -b --factory-startup --python scripts/render_navigation_examples.py -- \
  --input _static/demos/navigation --only connected --animate
blender -b --factory-startup --python scripts/render_navigation_examples.py -- \
  --input _static/demos/navigation --only house-3d --animate
```

The visually realistic section pairs camera recordings with trajectory cutaways
for Cinema den, Timber bedroom, and Billiards room. Each pair shares a 30-second
timeline and pauses offscreen. Clicking a pair enlarges both views in a dialog,
preserving their current playback position and pausing the other rooms. Escape,
the close button, or clicking the backdrop returns to the gallery.
Visible pairs autoplay muted, including when reduced motion is enabled, as requested.
Web copies in `_static/demos/realistic` use H.264 at 960 × 540 for camera views and
800 × 500 for trajectories, totaling approximately 13 MB. The trajectory copies
crop eight source pixels from the left to remove a baked-in dark edge. Original renders remain
in the corresponding `remi-scene/outputs` directories.

These recordings show camera views and trajectories, not encoder outputs.
The static pipeline beneath the gallery uses matching Timber bedroom screenshots
at five seconds: Simulation → Camera images → Vision encoder → Encoding. Stacked
image sheets indicate a sequence; a tapered block represents an encoder such as
DINO, MAE, or SAM3D. The output vectors are diagram elements, not measured latents,
and the page does not run these models. Parallel branches illustrate downstream
world and biological models. The world model feeds an external policy, whose
actions return to the simulation. An optional decoder branch ends in a lightly
blurred copy of the camera screenshot, not a measured reconstruction.
This diagram describes rendering followed by encoding, not the separate
mesh-conditioned latent prediction experiment.

The animated `#mesh-encoding` illustration below this pipeline explains the
geometry-field experiment in `remi-scene/scripts/room_geometry_field.py`.
A shared camera pose drives mesh visibility, an XYZ/hit-mask view, tri-plane
queries, and compact output tokens. Visibility is computed by raycasting a small
illustrative room at 32 × 24 samples. Fixed analytic fields stand in for learned
features; token colors summarize visible feature samples, not a trained network's
predictions. The CNN–Transformer block represents the actual experiment's readout.
The illustrated tri-planes show one scale; the experiment uses three resolutions.
The demo reuses local Three.js, caps rendering at 30 fps, loads near the viewport,
pauses when hidden or offscreen, and shows a still pose for reduced motion.

Vision-like sensing has two independent checkboxes in the Sensors row, with
fixed Gaussian spatial sigma 8 cm. Either or both vision sensors can be selected; each adds
24 response channels. Selecting both shows the circle and camera frustum.
Omnidirectional mode depends only on position and uses a dot with a pulsing circle.
Directionally tuned mode depends on position and movement heading and uses a camera
frustum. Its 24 preferred headings are evenly spaced with angular sigma pi/3;
the displayed frustum is an illustrative icon, not a calibrated field of view.
These are synthetic sensor responses, not RGB images or encoder outputs.

The field stack shows six example dimensions, with an ellipsis for omitted fields.
The encoding sequence shows eight example dimensions across eight recent vectors,
with four rows above and four below the ellipsis. The field stack shows its first
three and last three dimensions. Both views mark omitted
dimensions with a vertical ellipsis. Examples are distributed across the selected
sensor families. Every vector updates continuously from the shared clock, at delays
spaced four recorded steps (0.2 simulated seconds) apart. All four views
share the same playback clock. Directional fields change with heading; head-direction
fields are spatially uniform at any fixed heading. Fields and encoding cells share
a fixed viridis response scale from 0 to 1. PCA still uses all selected channels.

Regenerate these examples with the same simulator revision as the projections:

```bash
PYTHONPATH=../ratatougym ../ratatougym/.venv/bin/python scripts/export_response_fields.py
```

Heading uses the simulator's HeadDirectionCell model (24 cells, angular sigma
pi/3). In this replay, head orientation follows movement direction and holds
steady during stops. The boundary demo uses 24 wall-selective Gaussian fields:
six cells prefer each of the rectangular arena's four walls, with response widths
from 6 to 14 cm. Each cell's response decays with distance from its preferred wall,
independently of heading. This is a demo-specific extension; the simulator's current
BoundaryCell responds near all walls. Both exporters share the wall-selective maps,
so field layers, encoding traces and PCA use the same responses.

Projections are stored in `_static/demos/sensors/`, one file per sensor selection
and vision mode, fetched on demand. PCA includes twelve headings over a 20 × 20
spatial grid whenever heading cells or directionally tuned vision are selected.
Otherwise it uses a 40 × 40 spatial grid. The displayed 25,600 points are evaluated on a denser grid and transformed
through the same fitted PCA basis: 160 × 160 positions, or 40 × 40 positions
at 16 headings. The browser bilinearly refines each spatial grid to 102,400
rendered points, keeping heading layers separate. This changes only display
density, not the PCA basis or trajectory projection. Dragging the response
space rotates its camera independently of the room; playback stays synchronized. Each family contributes equal total variance.
The same basis projects the recorded trajectory. Sensor changes preserve playback
time; stale requests cannot override a newer selection. Export with:

```bash
OPENBLAS_NUM_THREADS=2 PYTHONPATH=../ratatougym \
  ../ratatougym/.venv/bin/python scripts/export_vision_demo.py \
  --recording _static/demos/neural-replay.json --output _static/demos/sensors
```

The recording is `_static/demos/neural-replay.json`. It includes the simulator
revision, seeds, room bounds, 4,096 positions and all seven nonempty sensor
combinations. It is loaded with Three.js only near the demo viewport.

For the original three sensor families, PCA is fitted to responses on a 40 × 40 free-space grid.
Each family is normalized to equal total spatial variance before concatenation.
The top three components are rigidly aligned to room axes and uniformly scaled
for display; this changes orientation and size, not the PCA subspace. Each room-grid sample appears as a semi-transparent blue point; no faces or
mesh lines are drawn. The same projection is applied to bilinearly
interpolated response maps along the trajectory. The caption reports retained
variance; the projection may fold or overlap and is not a recovered physical map.
Sensor changes interpolate between projections for 650 ms without resetting time.
At least one sensor must remain selected; the last selected toggle cannot be cleared.

Regenerate with the simulator environment from this website checkout:

```bash
PYTHONPATH=../ratatougym ../ratatougym/.venv/bin/python scripts/export_home_demo.py \
  --source ../ratatougym --output _static/demos/neural-replay.json
```

The CPU export validates finite projections and free-space trajectory positions.
It does not train encoders, launch Isaac or modify the simulator. Three.js 0.170.0
is vendored in `_static/vendor/` with its MIT license; the browser needs WebGL2
and does not request a CDN. Reduced-motion preferences show a stationary sample.

The neutral room mesh and its 1024-pixel lighting atlas are in
`_static/demos/room/`. Blender Cycles bakes diffuse color, direct and indirect
illumination at 96 samples, including wall contact shadows. Three.js displays
that texture without relighting it and adds a live shadow for the moving marker.
Sensor selection changes the right-hand projection and the agent icon; it does
not add rate-map overlays to the baked room. Rebuild the room with
Blender 4.2 (the bake runs on CPU with eight threads):

```bash
blender -b --factory-startup --python scripts/bake_demo_room.py -- \
  --output _static/demos/room
```

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
