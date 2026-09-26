// The recording contains real spatial maps and precomputed PCA projections.
const demo = document.querySelector('.neural-demo');
const status = document.querySelector('#demo-status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const playbackRate = 4;
let started = false;
let visible = false;
let resume = () => {};

async function initialize() {
  // Load Three.js and the data only when this section approaches the viewport.
  if (started) return;
  started = true;
  try {
    const [THREE, controls, fields, response, roomResponse, fieldResponse] = await Promise.all([
      import('./vendor/three-0.170.0.module.min.js'),
      import('./vendor/OrbitControls-0.170.0.js'),
      import('./sensory-fields.js'),
      fetch(demo.dataset.recording), fetch(demo.dataset.room), fetch(`${demo.dataset.fields}?v=wall-selective-8`)
    ]);
    if (!response.ok || !roomResponse.ok || !fieldResponse.ok) throw Error('Demo assets unavailable');
    const room = await roomResponse.json();
    const textureURL = new URL(room.texture, new URL(demo.dataset.room, document.baseURI));
    const texture = await new THREE.TextureLoader().loadAsync(textureURL.href);
    texture.colorSpace = THREE.SRGBColorSpace;
    const fieldData = await fieldResponse.json();
    createDemo(THREE, controls.OrbitControls, await response.json(), room, texture,
      fields.createResponseFields, fieldData);
  } catch (error) {
    status.textContent = 'The 3D demo could not load. WebGL2 is required.';
    console.error('Sensory demo:', error);
  }
}

// Refine the sampled spatial grid within each heading layer, never across folds.
function densifySurface(points, headingDomain) {
  const layers = headingDomain ? 16 : 1;
  const side = Math.sqrt(points.length / layers);
  const denseSide = side * 2;
  const dense = new Float32Array(points.length * 4 * 3);
  let offset = 0;

  // Bilinear interpolation preserves the projected grid's spatial neighborhood.
  for (let layer = 0; layer < layers; layer++) {
    const base = layer * side * side;
    for (let row = 0; row < denseSide; row++) {
      const y = row * (side - 1) / (denseSide - 1);
      const y0 = Math.min(Math.floor(y), side - 2);
      const fy = y - y0;
      for (let col = 0; col < denseSide; col++) {
        const x = col * (side - 1) / (denseSide - 1);
        const x0 = Math.min(Math.floor(x), side - 2);
        const fx = x - x0;

        // Adjacent samples describe the same local patch of sensor responses.
        const a = base + y0 * side + x0;
        const b = a + side;
        for (let axis = 0; axis < 3; axis++) {
          const top = points[a][axis] * (1 - fx) + points[a + 1][axis] * fx;
          const bottom = points[b][axis] * (1 - fx) + points[b + 1][axis] * fx;
          dense[offset++] = top * (1 - fy) + bottom * fy;
        }
      }
    }
  }
  return dense;
}

function createDemo(THREE, OrbitControls, data, bakedRoom, roomTexture, createFields, fieldData) {
  // Every view uses the same clock, sampled trajectory and physical room bounds.
  const [low, high] = data.bounds;
  const inputs = [...demo.querySelectorAll('[data-sensor]')];
  const projectionCache = new Map();
  let selectionRequest = 0;
  let directionalMode = false;
  const views = [];
  let mask = 1;
  let elapsed = 0;
  let previous = 0;
  let frame = 0;

  // Cycle through individual sensors until the first manual selection.
  let automaticSensors = true;
  let sensorCycleElapsed = 0;
  const sensorCycleInterval = 6000;

  function view(id) {
    const host = document.querySelector(id);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setClearColor(0xeff2f3, 0);
    host.append(renderer.domElement);

    // Orthographic cameras show depth without perspective size distortion.
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-7, 7, 7, -7, 0.1, 100);
    camera.position.set(13, 12, 15);
    camera.lookAt(0, 0.3, 0);
    const fill = new THREE.HemisphereLight(0xffffff, 0x8b9994, 2.4);
    scene.add(fill);
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(-4, 12, 8);
    scene.add(light);

    // Resize the drawing buffer independently for each responsive plot.
    const resize = new ResizeObserver(() => {
      const width = host.clientWidth, height = host.clientHeight;
      const aspect = width / height;
      camera.left = -6.6 * aspect;
      camera.right = 6.6 * aspect;
      camera.top = 6.6;
      camera.bottom = -6.6;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      render();
    });
    resize.observe(host);
    const result = { host, renderer, scene, camera, light, fill };
    views.push(result);
    return result;
  }

  const room = view('#room-plot');
  const sensory = view('#sensory-plot');
  const fieldView = view('#field-plot');
  // A lower viewing angle leaves a clear gap between the field groups.
  fieldView.camera.position.set(13, 8, 15);
  fieldView.camera.lookAt(0, 0.3, 0);
  const responseFields = createFields(THREE, fieldView, fieldData);

  // Sensor tabs preview the same spatial fields used by the population diagram.
  inputs.forEach(input => {
    const family = fieldData.families.find(item => item.bit === Number(input.value));
    const thumbnail = input.closest('label').querySelector('.sensor-preview');
    responseFields.preview(family, thumbnail, data);
  });

  // Give the room illustration a little more space around its edges.
  room.camera.zoom = 0.57;
  room.camera.updateProjectionMatrix();
  sensory.camera.zoom = 1.05;
  sensory.camera.updateProjectionMatrix();

  // Rotate only response space; the room and playback clock remain fixed.
  const orbit = new OrbitControls(sensory.camera, sensory.renderer.domElement);
  orbit.target.set(0, 0.3, 0);
  orbit.enablePan = false;
  orbit.enableZoom = false;
  orbit.rotateSpeed = 0.65;
  orbit.update();

  // Direct dragging also redraws a paused or reduced-motion view.
  orbit.addEventListener('change', render);
  orbit.addEventListener('start', () => sensory.host.classList.add('is-rotating'));
  orbit.addEventListener('end', () => sensory.host.classList.remove('is-rotating'));
  window.addEventListener('pagehide', () => orbit.dispose());
  function physical(coord) {
    const x = (coord[1] - low[1]) / (high[1] - low[1]) * 10 - 5;
    const z = (coord[0] - low[0]) / (high[0] - low[0]) * 10 - 5;
    return new THREE.Vector3(x, 0.08, z);
  }

  // The room's atlas contains Cycles diffuse light, bounce light and shadows.
  const roomGeometry = new THREE.BufferGeometry();
  roomGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bakedRoom.positions, 3));
  roomGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(bakedRoom.uvs, 2));
  const roomMaterial = new THREE.MeshBasicMaterial({ map: roomTexture, toneMapped: false });
  // Neutralize the warm tint and lift baked shadows while retaining their shape.
  roomMaterial.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      float neutral = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(neutral), 0.4);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.25);
    `);
  };
  room.scene.add(new THREE.Mesh(roomGeometry, roomMaterial));

  // Real-time shadows are only needed for the moving animal marker.
  room.renderer.shadowMap.enabled = true;
  room.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  room.fill.intensity = 0.7;
  room.light.position.set(-3, 10, 4);
  room.light.intensity = 3;
  room.light.castShadow = true;

  // Keep the shadow camera tight around the arena for a clean moving shadow.
  const shadow = room.light.shadow;
  shadow.mapSize.set(1024, 1024);
  Object.assign(shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 30 });
  shadow.camera.updateProjectionMatrix();
  shadow.bias = -0.0002;
  shadow.normalBias = 0.015;

  // A transparent receiver overlays only the marker shadow on the baked floor.
  const receiver = new THREE.Mesh(new THREE.PlaneGeometry(10, 10),
    new THREE.ShadowMaterial({ color: 0x68747b, opacity: 0.18 }));
  receiver.rotation.x = -Math.PI / 2;
  receiver.position.y = 0.012;
  receiver.receiveShadow = true;
  room.scene.add(receiver);

  // A neutral dot identifies the position in every sensor configuration.
  const animal = new THREE.Group();
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0xe34b4b, roughness: 0.75,
      emissive: 0xe34b4b, emissiveIntensity: 0.08,
      opacity: 0.8, transparent: true, depthTest: false, depthWrite: false }));
  dot.castShadow = true;
  dot.renderOrder = 6;
  animal.add(dot);
  room.scene.add(animal);

  // A pulsing full ring illustrates panoramic sensing around the agent.
  const panorama = new THREE.Mesh(new THREE.RingGeometry(0.60, 0.67, 64),
    new THREE.MeshBasicMaterial({ color: 0x858585, side: THREE.DoubleSide,
      transparent: true, opacity: 0.85, depthWrite: false, depthTest: false }));
  panorama.rotation.x = -Math.PI / 2;
  panorama.position.y = -0.04;
  panorama.renderOrder = 5;
  animal.add(panorama);

  // The camera icon faces local +z; its opening is illustrative, not an RGB FOV.
  const frustum = new THREE.Group();
  const corners = [[-0.5, -0.25, 1], [0.5, -0.25, 1],
    [0.5, 0.25, 1], [-0.5, 0.25, 1]];
  const edges = [], faces = [];
  corners.forEach((corner, index) => {
    const next = corners[(index + 1) % corners.length];
    edges.push(0, 0, 0, ...corner, ...corner, ...next);
    faces.push(0, 0, 0, ...corner, ...next);
  });

  // Thin edges and faint faces leave the floor and path visible through the icon.
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3));
  frustum.add(new THREE.LineSegments(edgeGeometry,
    new THREE.LineBasicMaterial({ color: 0x484848, transparent: true, opacity: 0.75 })));
  const faceGeometry = new THREE.BufferGeometry();
  faceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(faces, 3));
  frustum.add(new THREE.Mesh(faceGeometry, new THREE.MeshBasicMaterial({
    color: 0x888888, side: THREE.DoubleSide, transparent: true, opacity: 0.10, depthWrite: false
  })));
  animal.add(frustum);

  // The projected cursor uses the same timestep, without a separate animation.
  const cursor = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xe34b4b, opacity: 0.8, depthTest: false, transparent: true }));
  cursor.renderOrder = 4;
  sensory.scene.add(cursor);
  const physicalPath = data.coords.map(physical);
  const trailCount = 180;

  // Sample headings once so pauses and skipped animation frames stay consistent.
  let lastHeading = 0;
  const movementHeadings = physicalPath.map((point, index) => {
    const next = physicalPath[Math.min(index + 1, data.steps - 1)];
    const direction = next.clone().sub(point);
    if (direction.lengthSq() > 1e-10) {
      lastHeading = Math.atan2(direction.x, direction.z);
    }
    return lastHeading;
  });

  function trail(view, projected = false) {
    // A ribbon gives continuous paths a reliable width in WebGL.
    const geometry = new THREE.BufferGeometry();
    const vertexCount = (trailCount + 1) * 2;
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertexCount * 4), 4));
    const indices = [];
    for (let index = 0; index < trailCount; index++) {
      const a = index * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geometry.setIndex(indices);

    // Per-vertex alpha fades older sections of the translucent red trajectory.
    const material = new THREE.MeshBasicMaterial({
      color: 0xe34b4b, opacity: 0.68, vertexColors: true, depthTest: !projected,
      side: THREE.DoubleSide, transparent: true, depthWrite: false
    });
    const line = new THREE.Mesh(geometry, material);
    line.frustumCulled = false;
    line.renderOrder = 3;
    line.userData.view = view;
    view.scene.add(line);
    return line;
  }

  const roomTrail = trail(room);
  const sensoryTrail = trail(sensory, true);
  let surface = new Float32Array();
  let projectedPath = new Float32Array(data.steps * 3);
  let transition = null;

  // Draw projected room samples as faint points, without faces or mesh lines.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(surface, 3));
  const pointCanvas = document.createElement('canvas');
  pointCanvas.width = pointCanvas.height = 32;
  const context = pointCanvas.getContext('2d');

  // A circular alpha texture gives small points soft, antialiased edges.
  const gradient = context.createRadialGradient(16, 16, 8, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);

  // A single blue keeps overlapping samples legible without surface shading.
  const material = new THREE.PointsMaterial({
    color: 0x377fcd, map: new THREE.CanvasTexture(pointCanvas),
    size: 0.8, sizeAttenuation: false, transparent: true, opacity: 0.18,
    depthWrite: false, depthTest: false
  });
  const cloud = new THREE.Points(geometry, material);
  cloud.frustumCulled = false;
  sensory.scene.add(cloud);

  async function selectSensors() {
    const request = ++selectionRequest;
    const selectedMask = inputs.reduce((sum, input) => sum + (input.checked ? Number(input.value) : 0), 0);
    const tuned = Boolean(selectedMask & 64);
    const panoramic = Boolean(selectedMask & 8);
    const mode = tuned ? (panoramic ? 'combined' : 'directional') : 'panoramic';

    // Reuse the existing single-vision projections; combined files contain both.
    const projectionMask = (selectedMask & ~64) | (tuned ? 8 : 0);

    // Fetch only this sensor combination and reuse completed or pending requests.
    let selection = null;
    demo.dataset.loading = 'true';
    if (selectedMask) {
      const key = `${mode}-${projectionMask}`;
      const caption = document.querySelector('#projection-caption');
      caption.textContent = 'Loading sensor responses…';
      try {
        if (!projectionCache.has(key)) {
          const url = new URL(`${key}.json?v=wall-selective-1`, new URL(demo.dataset.projections, document.baseURI));
          const pending = fetch(url).then(response => {
            if (!response.ok) throw Error('Sensor response data unavailable');
            return response.json();
          });
          projectionCache.set(key, pending);
        }
        selection = await projectionCache.get(key);
      } catch (error) {
        projectionCache.delete(key);
        if (request !== selectionRequest) return;
        caption.textContent = 'Sensor responses could not load. Change a setting to retry.';
        demo.dataset.loading = 'false';
        return;
      }
    }
    if (request !== selectionRequest) return;

    // Apply a complete selection atomically, even when settings change quickly.
    const wasVisible = cloud.visible;
    mask = selectedMask;
    directionalMode = tuned;
    panorama.visible = panoramic;
    frustum.visible = directionalMode;
    demo.dataset.sensors = String(mask);
    demo.dataset.visionMode = panoramic || tuned ? mode : 'off';
    demo.dataset.loading = 'false';
    demo.dataset.ready = 'true';
    cloud.visible = cursor.visible = sensoryTrail.visible = mask !== 0;
    const caption = document.querySelector('#projection-caption');

    // An empty selection has no response space; the physical animal keeps moving.
    if (!mask) {
      caption.textContent = 'Select a sensor to show its response space.';
      transition = null;
      render();
      return;
    }
    const next = selection.projection;
    const domain = selection.pca_domain;
    caption.textContent = '';
    responseFields.select(mask);

    // The first visible frame uses the selected manifold at its final density.
    const nextSurface = densifySurface(next.surface, domain === 'position + heading');
    const nextPath = new Float32Array(next.path.flat());
    if (!wasVisible || surface.length !== nextSurface.length) {
      surface = nextSurface;
      projectedPath = nextPath;
      geometry.setAttribute('position', new THREE.BufferAttribute(surface, 3));
      transition = null;
    } else {
      // Only morph when replacing a manifold that is already visible.
      transition = {
        start: performance.now(), fromSurface: surface.slice(), fromPath: projectedPath.slice(),
        toSurface: nextSurface, toPath: nextPath
      };
      if (reducedMotion.matches) updateProjection(transition.start + 700);
    }
    render();
    resume();
  }

  function updateProjection(now) {
    if (!transition) return;
    const fraction = Math.min((now - transition.start) / 650, 1);
    const blend = fraction * fraction * (3 - 2 * fraction);
    for (let index = 0; index < surface.length; index++) {
      surface[index] = transition.fromSurface[index] * (1 - blend) + transition.toSurface[index] * blend;
    }
    for (let index = 0; index < projectedPath.length; index++) {
      projectedPath[index] = transition.fromPath[index] * (1 - blend) + transition.toPath[index] * blend;
    }
    geometry.attributes.position.needsUpdate = true;
    if (fraction === 1) transition = null;
  }

  function pointAt(step, projected) {
    const index = Math.floor(step), blend = step - index;
    const next = Math.min(index + 1, data.steps - 1);
    if (!projected) return physicalPath[index].clone().lerp(physicalPath[next], blend);
    const a = new THREE.Vector3().fromArray(projectedPath, index * 3);
    const b = new THREE.Vector3().fromArray(projectedPath, next * 3);
    return a.lerp(b, blend);
  }

  function updateTrail(line, step, projected) {
    const end = Math.floor(step);
    const start = Math.max(0, end - trailCount + 1);
    const attribute = line.geometry.attributes.position;
    const colors = line.geometry.attributes.color;
    const points = [];
    for (let index = start; index <= end; index++) {
      points.push(pointAt(index, projected));
    }
    points.push(pointAt(step, projected));

    // Face the camera and maintain a 2.5 CSS-pixel width at any viewport size.
    const { camera, host } = line.userData.view;
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const viewHeight = (camera.top - camera.bottom) / camera.zoom;
    const halfWidth = 1.25 * viewHeight / Math.max(host.clientHeight, 1);
    const offset = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

    // Join every recorded sample, including the interpolated moving endpoint.
    points.forEach((point, index) => {
      const before = points[Math.max(0, index - 1)];
      const after = points[Math.min(points.length - 1, index + 1)];
      tangent.subVectors(after, before);
      offset.crossVectors(tangent, forward);
      if (offset.lengthSq() > 1e-10) side.copy(offset).normalize();
      offset.copy(side).multiplyScalar(halfWidth);

      // The head stays opaque while the oldest segment fades smoothly away.
      const sample = index === points.length - 1 ? step : start + index;
      const recency = Math.max(0, 1 - (step - sample) / (trailCount - 1));
      const alpha = recency ** 0.8;
      attribute.setXYZ(index * 2, point.x - offset.x, point.y - offset.y, point.z - offset.z);
      attribute.setXYZ(index * 2 + 1, point.x + offset.x, point.y + offset.y, point.z + offset.z);
      colors.setXYZW(index * 2, 1, 1, 1, alpha);
      colors.setXYZW(index * 2 + 1, 1, 1, 1, alpha);
    });
    attribute.needsUpdate = true;
    colors.needsUpdate = true;
    line.geometry.setDrawRange(0, (points.length - 1) * 6);
  }

  function render() {
    // Interpolate both recorded paths at exactly the same fractional timestep.
    const step = elapsed / data.dt_ms;
    animal.position.copy(pointAt(step, false));
    animal.position.y += directionalMode ? 0.28 : 0.10;
    cursor.position.copy(pointAt(step, true));
    responseFields.update(step, animal.position);

    // The camera icon and directional responses use the same movement heading.
    animal.rotation.y = movementHeadings[Math.floor(step)];

    // Expand from a small ring, soften at the peak, then spring back inward.
    const phase = elapsed / playbackRate / 1800 * Math.PI * 2;
    const pulse = (1 - Math.cos(phase)) / 2;
    const ringScale = reducedMotion.matches ? 0.8 : 0.45 + pulse;
    panorama.scale.setScalar(ringScale);
    panorama.material.opacity = reducedMotion.matches ? 0.85 : 0.85 - 0.4 * pulse;
    updateTrail(roomTrail, step, false);
    updateTrail(sensoryTrail, step, true);
    views.forEach(item => {
      item.host.dataset.step = step.toFixed(3);
      item.renderer.render(item.scene, item.camera);
    });
  }

  function animate(now) {
    frame = 0;
    if (!visible || document.hidden) { previous = 0; return; }
    const delta = previous ? Math.min(now - previous, 80) : 0;
    if (!reducedMotion.matches) elapsed += delta * playbackRate;

    // Count visible playback time only, allowing each loaded response to be seen.
    const ready = demo.dataset.ready === 'true' && demo.dataset.loading === 'false';
    if (automaticSensors && ready && !reducedMotion.matches) {
      sensorCycleElapsed += delta;
      if (sensorCycleElapsed >= sensorCycleInterval) cycleSensors();
    }
    previous = now;
    elapsed %= (data.steps - 1) * data.dt_ms;
    updateProjection(now);
    render();
    if (!reducedMotion.matches || transition) frame = requestAnimationFrame(animate);
  }

  function cycleSensors() {
    sensorCycleElapsed = 0;
    const current = inputs.findIndex(input => input.checked);
    const next = (current + 1) % inputs.length;
    inputs.forEach((input, index) => { input.checked = index === next; });
    selectSensors();
  }

  // Suspend GPU work offscreen; resuming never advances one view independently.
  resume = () => {
    if (!visible || document.hidden || frame) return;
    previous = 0;
    frame = requestAnimationFrame(animate);
  };
  // Keep the last selected sensor without interrupting an in-flight projection.
  inputs.forEach(input => input.addEventListener('change', () => {
    automaticSensors = false;
    if (!inputs.some(sensor => sensor.checked)) {
      input.checked = true;
      return;
    }
    selectSensors();
  }));
  document.addEventListener('visibilitychange', resume);
  reducedMotion.addEventListener('change', resume);
  demo.querySelector('.sensor-options').disabled = false;

  // One recorded run loops automatically; the browser does not simulate sensors.
  status.textContent = '';
  cloud.visible = cursor.visible = sensoryTrail.visible = false;
  panorama.visible = frustum.visible = false;
  selectSensors();
  resume();
  window.addEventListener('pagehide', () => cancelAnimationFrame(frame));
}

// Lazy loading does not depend on the neighboring video gallery succeeding.
new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) initialize();
}, { rootMargin: '200px' }).observe(demo);
new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  if (visible) resume();
}).observe(demo);
