// Small rate maps select a population for the synchronized sampling example.
const host = document.querySelector('.encoding-explanation');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let started = false;
let visible = false;
let resume = () => {};

async function initialize() {
  if (started) return;
  started = true;
  try {
    const [THREE, helper, fieldResponse, recordingResponse] = await Promise.all([
      import('./vendor/three-0.170.0.module.min.js'),
      import('./sensory-fields.js'),
      fetch(`${host.dataset.fields}?v=wall-selective-8`), fetch(host.dataset.recording)
    ]);
    if (!fieldResponse.ok || !recordingResponse.ok) throw Error('Example assets unavailable');
    const fields = await fieldResponse.json();
    const recording = await recordingResponse.json();
    createExample(THREE, helper.createResponseFields, fields, recording);
  } catch (error) {
    document.querySelector('.explanation-status').textContent = 'The encoding example could not load.';
    console.error('Encoding example:', error);
  }
}

function createExample(THREE, createFields, fields, recording) {
  const fieldHost = host.querySelector('.field-canvas');
  const sequence = host.querySelector('.encoding-explanation-sequence');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  fieldHost.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-7, 7, 6.6, -6.6, 0.1, 100);

  // Match the diagram's cutaway angle; both views use the same real recording.
  camera.position.set(13, 8, 15);
  camera.lookAt(0, 0.3, 0);
  const sampling = createFields(THREE, { host: fieldHost, scene, camera }, fields, sequence);
  sampling.select(8);
  const [low, high] = recording.bounds;
  let elapsed = 0, previous = 0, frame = 0;

  function draw() {
    const step = elapsed / recording.dt_ms;
    const index = Math.floor(step), fraction = step - index;
    const next = Math.min(index + 1, recording.steps - 1);
    const a = recording.coords[index], b = recording.coords[next];
    const row = a[0] + (b[0] - a[0]) * fraction;
    const col = a[1] + (b[1] - a[1]) * fraction;

    // Convert room coordinates to the helper's ten-unit physical coordinate frame.
    sampling.update(step, {
      x: (col - low[1]) / (high[1] - low[1]) * 10 - 5,
      z: (row - low[0]) / (high[0] - low[0]) * 10 - 5
    });
    renderer.render(scene, camera);
    fieldHost.dataset.step = step.toFixed(3);
  }

  // Switch the sampled population without restarting the shared trajectory.
  const options = host.querySelector('.field-options');
  const examples = [[2, 'Grid cells'], [1, 'Place cells'], [32, 'Boundary cells'],
    [16, 'Head-direction cells'], [8, 'SMC · omnidirectional']];
  examples.forEach(([bit, label]) => {
    const family = fields.families.find(item => item.bit === bit);
    const button = document.createElement('button');
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(bit === 8));
    const thumbnail = document.createElement('canvas');
    thumbnail.setAttribute('aria-hidden', 'true');
    sampling.preview(family, thumbnail, recording);
    button.append(thumbnail);
    options.append(button);
    button.addEventListener('click', () => {
      sampling.select(bit);
      options.querySelectorAll('button').forEach(item => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      fieldHost.setAttribute('aria-label', `${label}: population response fields`);
      draw();
    });
  });

  function animate(now) {
    frame = 0;
    if (!visible || document.hidden) { previous = 0; return; }
    if (previous && !motion.matches) elapsed += Math.min(now - previous, 80) * 4;
    previous = now;
    elapsed %= (recording.steps - 1) * recording.dt_ms;
    draw();
    if (!motion.matches) frame = requestAnimationFrame(animate);
  }

  // Only run while visible; returning to the example preserves its position.
  resume = () => {
    if (!visible || document.hidden || frame) return;
    previous = 0;
    frame = requestAnimationFrame(animate);
  };
  const resize = new ResizeObserver(() => {
    const width = fieldHost.clientWidth, height = fieldHost.clientHeight;
    camera.left = -6.6 * width / height;
    camera.right = 6.6 * width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    draw();
  });
  resize.observe(fieldHost);
  document.addEventListener('visibilitychange', resume);
  motion.addEventListener('change', resume);
  host.dataset.ready = 'true';
  resume();

  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    renderer.dispose();
  });
}


new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) initialize();
}, { rootMargin: '200px' }).observe(host);
new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  if (visible) resume();
}).observe(host);
