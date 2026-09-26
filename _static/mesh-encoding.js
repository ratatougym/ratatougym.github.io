// Method illustration: real visibility on a small mesh, schematic feature values.
const host = document.querySelector('.mesh-encoding-demo');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let initialized = false;
let visible = false;
let resume = () => {};

async function initialize() {
  if (initialized) return;
  initialized = true;
  try {
    const THREE = await import('./vendor/three-0.170.0.module.min.js');
    createIllustration(THREE);
    host.querySelector('.mesh-demo-status').textContent = '';
    host.dataset.ready = 'true';
  } catch (error) {
    host.querySelector('.mesh-demo-status').textContent = 'The mesh illustration could not load. WebGL2 is required.';
    console.error('Mesh encoding illustration:', error);
  }
}

function createIllustration(T) {
  const roomHost = host.querySelector('.mesh-room-view');
  const planesHost = host.querySelector('.mesh-planes-view');
  const surface = host.querySelector('.mesh-surface-map');
  const tokens = host.querySelector('.mesh-latent-tokens');
  const surfaceContext = surface.getContext('2d');
  const tokenContext = tokens.getContext('2d');

  // The sparse camera grid keeps the browser visibility pass inexpensive.
  const mapWidth = 32, mapHeight = 24;
  const pixels = document.createElement('canvas');
  pixels.width = mapWidth;
  pixels.height = mapHeight;
  const pixelContext = pixels.getContext('2d');
  const coordinates = pixelContext.createImageData(mapWidth, mapHeight);
  surface.width = 384;
  surface.height = 288;
  tokens.width = 264;
  tokens.height = 180;

  // Both three-dimensional views share the existing homepage's renderer library.
  function view(element, position, target, span) {
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    element.append(renderer.domElement);
    const scene = new T.Scene();
    const camera = new T.OrthographicCamera(-span, span, span, -span, 0.1, 60);
    camera.position.set(...position);
    camera.lookAt(...target);
    return { element, renderer, scene, camera, span };
  }
  const room = view(roomHost, [9, 8, 11], [0, .6, 0], 4.4);
  const planes = view(planesHost, [7, 5, 8], [0, 0, 0], 2.8);
  room.scene.add(new T.HemisphereLight(0xffffff, 0xb6bdc4, 2.1));
  const light = new T.DirectionalLight(0xffffff, 2.2);
  light.position.set(1, 8, 5);
  room.scene.add(light);

  // A simplified room mesh makes occlusion and the moving camera easy to read.
  const geometry = [];
  function box(size, position, color, divisions = 1) {
    const mesh = new T.Mesh(new T.BoxGeometry(...size, divisions, divisions, divisions),
      new T.MeshStandardMaterial({ color, roughness: .85 }));
    mesh.position.set(...position);
    const wire = new T.LineSegments(new T.WireframeGeometry(mesh.geometry),
      new T.LineBasicMaterial({ color: 0x98a7b3, transparent: true, opacity: .22 }));
    mesh.add(wire);
    room.scene.add(mesh);
    geometry.push(mesh);
    return mesh;
  }
  box([6, .12, 5], [0, -.08, 0], 0xe0e2e2, 4);
  box([6, 2.3, .09], [0, 1.12, -2.5], 0xe2e4e5, 3);
  box([.09, 2.3, 5], [-3, 1.12, 0], 0xd9dddf, 3);
  box([1.8, .38, 2.4], [-1.35, .19, -1], 0xc7c3cb, 2);
  box([1.7, .22, 2.25], [-1.35, .49, -1], 0xe6e3e9, 2);
  box([1.65, .72, .1], [-1.35, .6, -2.2], 0xbbb2c5);
  box([.72, .6, .65], [.1, .3, -1.95], 0xc4d2cb);
  box([.6, 1.5, 1.2], [-2.6, .75, 1.25], 0xd0c6ba, 2);
  room.scene.updateMatrixWorld(true);

  // Use the same pose for the frustum, visibility samples, and feature lookup.
  const sensor = new T.PerspectiveCamera(55, 4 / 3, .06, 20);
  const frustum = new T.Group();
  const corners = [[-.36, -.27, -.65], [.36, -.27, -.65],
    [.36, .27, -.65], [-.36, .27, -.65]];
  const frustumLines = corners.flatMap((point, index) =>
    [0, 0, 0, ...point, ...point, ...corners[(index + 1) % 4]]);
  const frustumGeometry = new T.BufferGeometry();
  frustumGeometry.setAttribute('position', new T.Float32BufferAttribute(frustumLines, 3));
  frustum.add(new T.LineSegments(frustumGeometry,
    new T.LineBasicMaterial({ color: 0x647b8c, transparent: true, opacity: .85 })));
  room.scene.add(frustum);

  // The warm marker identifies one shared surface point in all three views.
  function marker(scene, radius) {
    const dot = new T.Mesh(new T.SphereGeometry(radius, 12, 8),
      new T.MeshBasicMaterial({ color: 0xc88873, depthTest: false }));
    dot.renderOrder = 8;
    scene.add(dot);
    return dot;
  }
  const surfaceDot = marker(room.scene, .065);
  const cameraDot = new T.Mesh(new T.SphereGeometry(.07, 12, 8),
    new T.MeshBasicMaterial({ color: 0x709bb9 }));
  frustum.add(cameraDot);
  const rayPositions = new Float32Array(6);
  const rayGeometry = new T.BufferGeometry();
  rayGeometry.setAttribute('position', new T.BufferAttribute(rayPositions, 3));
  room.scene.add(new T.Line(rayGeometry,
    new T.LineBasicMaterial({ color: 0xc88873, transparent: true, opacity: .55 })));

  // Fixed analytic patterns stand in for the learned, multiscale feature planes.
  function field(u, v, channel) {
    const frequency = 2.2 + channel * .31;
    const wave = Math.sin(u * frequency * Math.PI + channel * .7);
    const cross = Math.cos(v * (frequency + .8) * Math.PI - channel * .4);
    return .5 + .25 * wave + .2 * cross;
  }
  const palette = [[111, 153, 181], [157, 136, 176], [116, 160, 144]];
  function featureColor(value, channel) {
    const base = palette[channel % 3];
    return base.map(color => Math.round(239 + (color - 239) * (.18 + value * .72)));
  }
  const planeDefinitions = [
    { name: 'XY', axes: [0, 1], rotation: [0, 0, 0], position: [0, 0, -1.22] },
    { name: 'XZ', axes: [0, 2], rotation: [Math.PI / 2, 0, 0], position: [0, -1.22, 0] },
    { name: 'YZ', axes: [2, 1], rotation: [0, -Math.PI / 2, 0], position: [-1.22, 0, 0] },
  ];

  // Plane textures stay fixed; only the queried coordinates move with visibility.
  const planeViews = planeDefinitions.map((definition, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const color = featureColor(field(x / 63, 1 - y / 63, index), index);
        ctx.fillStyle = `rgb(${color.join(',')})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const mesh = new T.Mesh(new T.PlaneGeometry(2.4, 2.4),
      new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }));
    mesh.rotation.set(...definition.rotation);
    mesh.position.set(...definition.position);
    planes.scene.add(mesh);

    // Outline the planes and project their names just beyond the outside edges.
    mesh.add(new T.LineSegments(new T.EdgesGeometry(mesh.geometry),
      new T.LineBasicMaterial({ color: 0x9caebb, transparent: true, opacity: .6 })));
    const label = document.createElement('span');
    label.className = 'mesh-plane-label';
    label.textContent = definition.name;
    planesHost.append(label);
    return { mesh, definition, dot: marker(planes.scene, .045), label };
  });
  const fieldDot = marker(planes.scene, .055);
  const projectionPositions = new Float32Array(18);
  const projectionGeometry = new T.BufferGeometry();
  projectionGeometry.setAttribute('position', new T.BufferAttribute(projectionPositions, 3));
  planes.scene.add(new T.LineSegments(projectionGeometry,
    new T.LineBasicMaterial({ color: 0xc88873, transparent: true, opacity: .65, depthTest: false })));
  planes.scene.updateMatrixWorld(true);

  // Ray intersections provide world coordinates and a valid-surface mask.
  const raycaster = new T.Raycaster();
  const ndc = new T.Vector2();
  const normalized = point => [(point.x + 3) / 6, point.y / 2.3, (point.z + 2.5) / 5];
  const samplePoint = new T.Vector3();
  const sums = new Float64Array(18);
  function visibilityMap() {
    sums.fill(0);
    let count = 0;
    for (let row = 0; row < mapHeight; row++) {
      for (let col = 0; col < mapWidth; col++) {
        ndc.set((col + .5) / mapWidth * 2 - 1, 1 - (row + .5) / mapHeight * 2);
        raycaster.setFromCamera(ndc, sensor);
        const hit = raycaster.intersectObjects(geometry, false)[0];
        const offset = (row * mapWidth + col) * 4;
        coordinates.data[offset + 3] = hit ? 255 : 0;
        if (!hit) continue;
        const xyz = normalized(hit.point);
        for (let channel = 0; channel < 3; channel++) {
          coordinates.data[offset + channel] = 125 + 100 * Math.max(0, Math.min(1, xyz[channel]));
        }
        planeDefinitions.forEach(({ axes }, plane) => {
          for (let feature = 0; feature < 6; feature++) {
            sums[plane * 6 + feature] += field(xyz[axes[0]], xyz[axes[1]], plane + feature);
          }
        });
        count++;
      }
    }
    for (let index = 0; index < sums.length; index++) sums[index] /= Math.max(count, 1);
    pixelContext.putImageData(coordinates, 0, 0);
    surfaceContext.clearRect(0, 0, surface.width, surface.height);
    surfaceContext.imageSmoothingEnabled = false;
    surfaceContext.drawImage(pixels, 0, 0, surface.width, surface.height);

    // The center ray supplies a shared surface marker, not a whole-image latent.
    raycaster.setFromCamera(new T.Vector2(0, 0), sensor);
    const center = raycaster.intersectObjects(geometry, false)[0];
    if (!center) return false;
    samplePoint.copy(center.point);
    surfaceContext.beginPath();
    surfaceContext.arc(surface.width / 2, surface.height / 2, 6, 0, Math.PI * 2);
    surfaceContext.strokeStyle = '#fff';
    surfaceContext.lineWidth = 3;
    surfaceContext.stroke();
    surfaceContext.fillStyle = '#c88873';
    surfaceContext.fill();
    return true;
  }

  // The token colors summarize visible feature samples for this illustration.
  // They are not outputs from a trained CNN/Transformer running in the browser.
  function drawTokens() {
    tokenContext.clearRect(0, 0, tokens.width, tokens.height);
    for (let token = 0; token < 4; token++) {
      const x = 8 + token * 64;
      tokenContext.fillStyle = '#e1e7ec';
      tokenContext.beginPath();
      tokenContext.roundRect(x, 4, 48, 172, 6);
      tokenContext.fill();
      for (let channel = 0; channel < 8; channel++) {
        const value = sums[(token * 3 + channel) % sums.length];
        const color = featureColor(value, token);
        tokenContext.fillStyle = `rgb(${color.join(',')})`;
        tokenContext.fillRect(x + 5, 10 + channel * 20, 38, 17);
      }
    }
  }

  // The browser evaluates all panels at the same pose and time step.
  function draw(seconds) {
    const phase = seconds * Math.PI / 12;
    sensor.position.set(1 + .7 * Math.sin(phase), .95 + .1 * Math.sin(phase * 2), .7 + .75 * Math.cos(phase));
    sensor.lookAt(-1.1 + .5 * Math.sin(phase), .8, -1.5 + .5 * Math.cos(phase));
    sensor.updateMatrixWorld(true);
    frustum.position.copy(sensor.position);
    frustum.quaternion.copy(sensor.quaternion);
    const hit = visibilityMap();
    surfaceDot.visible = fieldDot.visible = hit;
    surfaceDot.position.copy(samplePoint);
    sensor.position.toArray(rayPositions, 0);
    (hit ? samplePoint : sensor.position).toArray(rayPositions, 3);
    rayGeometry.attributes.position.needsUpdate = true;

    // Project one surface point onto XY, XZ, and YZ without moving the fields.
    const xyz = normalized(samplePoint).map(value => (value - .5) * 2.4);
    fieldDot.position.set(...xyz);
    planeViews.forEach(({ mesh, definition, dot, label }, index) => {
      const [u, v] = definition.axes.map(axis => xyz[axis]);
      dot.position.copy(mesh.localToWorld(new T.Vector3(u, v, .008)));
      dot.visible = hit;
      fieldDot.position.toArray(projectionPositions, index * 6);
      dot.position.toArray(projectionPositions, index * 6 + 3);
      const anchor = mesh.localToWorld(new T.Vector3(index === 1 ? 1.45 : 0, index === 1 ? 0 : 1.45, 0));
      anchor.project(planes.camera);
      label.style.left = `${(anchor.x + 1) * planesHost.clientWidth / 2}px`;
      label.style.top = `${(1 - anchor.y) * planesHost.clientHeight / 2}px`;
    });
    projectionGeometry.attributes.position.needsUpdate = true;
    drawTokens();
    room.renderer.render(room.scene, room.camera);
    planes.renderer.render(planes.scene, planes.camera);
    host.dataset.time = seconds.toFixed(3);
  }

  // Render at 30 fps only while visible; reduced motion shows a static pose.
  let frame = 0, previous = 0, elapsed = 0;
  function animate(now) {
    frame = 0;
    if (!visible || document.hidden) { previous = 0; return; }
    if (previous && now - previous < 32) {
      frame = requestAnimationFrame(animate);
      return;
    }
    if (previous && !motion.matches) elapsed += Math.min(now - previous, 100) / 1000;
    previous = now;
    draw(elapsed);
    if (!motion.matches) frame = requestAnimationFrame(animate);
  }
  resume = () => {
    if (!visible || document.hidden) {
      cancelAnimationFrame(frame);
      frame = previous = 0;
      return;
    }
    if (!frame) frame = requestAnimationFrame(animate);
  };

  // Resize both views without resetting the camera trajectory.
  const resize = new ResizeObserver(() => {
    [room, planes].forEach(({ element, renderer, camera, span }) => {
      const width = element.clientWidth, height = element.clientHeight;
      camera.left = -span * width / height;
      camera.right = span * width / height;
      camera.top = span;
      camera.bottom = -span;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    draw(elapsed);
  });
  resize.observe(roomHost);
  resize.observe(planesHost);
  document.addEventListener('visibilitychange', resume);
  motion.addEventListener('change', resume);
  resume();
}

if (host) {
  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) initialize();
  }, { rootMargin: '200px' }).observe(host);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    resume();
  }).observe(host);
}
