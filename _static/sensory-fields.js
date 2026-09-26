// Example channels explain sampling; the manifold still uses every selected channel.
export function createResponseFields(THREE, view, data, sequence = document.querySelector('#encoding-sequence')) {
  const canvas = document.createElement('canvas');
  sequence.append(canvas);
  const context = canvas.getContext('2d');
  const labelFont = getComputedStyle(sequence).fontFamily;
  // Standard 256-sample viridis table, exported from Matplotlib.
  const paletteHex = `
    440154 440256 450457 450559 46075a 46085c 460a5d 460b5e
    470d60 470e61 471063 471164 471365 481467 481668 481769
    48186a 481a6c 481b6d 481c6e 481d6f 481f70 482071 482173
    482374 482475 482576 482677 482878 482979 472a7a 472c7a
    472d7b 472e7c 472f7d 46307e 46327e 46337f 463480 453581
    453781 453882 443983 443a83 443b84 433d84 433e85 423f85
    424086 424186 414287 414487 404588 404688 3f4788 3f4889
    3e4989 3e4a89 3e4c8a 3d4d8a 3d4e8a 3c4f8a 3c508b 3b518b
    3b528b 3a538b 3a548c 39558c 39568c 38588c 38598c 375a8c
    375b8d 365c8d 365d8d 355e8d 355f8d 34608d 34618d 33628d
    33638d 32648e 32658e 31668e 31678e 31688e 30698e 306a8e
    2f6b8e 2f6c8e 2e6d8e 2e6e8e 2e6f8e 2d708e 2d718e 2c718e
    2c728e 2c738e 2b748e 2b758e 2a768e 2a778e 2a788e 29798e
    297a8e 297b8e 287c8e 287d8e 277e8e 277f8e 27808e 26818e
    26828e 26828e 25838e 25848e 25858e 24868e 24878e 23888e
    23898e 238a8d 228b8d 228c8d 228d8d 218e8d 218f8d 21908d
    21918c 20928c 20928c 20938c 1f948c 1f958b 1f968b 1f978b
    1f988b 1f998a 1f9a8a 1e9b8a 1e9c89 1e9d89 1f9e89 1f9f88
    1fa088 1fa188 1fa187 1fa287 20a386 20a486 21a585 21a685
    22a785 22a884 23a983 24aa83 25ab82 25ac82 26ad81 27ad81
    28ae80 29af7f 2ab07f 2cb17e 2db27d 2eb37c 2fb47c 31b57b
    32b67a 34b679 35b779 37b878 38b977 3aba76 3bbb75 3dbc74
    3fbc73 40bd72 42be71 44bf70 46c06f 48c16e 4ac16d 4cc26c
    4ec36b 50c46a 52c569 54c568 56c667 58c765 5ac864 5cc863
    5ec962 60ca60 63cb5f 65cb5e 67cc5c 69cd5b 6ccd5a 6ece58
    70cf57 73d056 75d054 77d153 7ad151 7cd250 7fd34e 81d34d
    84d44b 86d549 89d548 8bd646 8ed645 90d743 93d741 95d840
    98d83e 9bd93c 9dd93b a0da39 a2da37 a5db36 a8db34 aadc32
    addc30 b0dd2f b2dd2d b5de2b b8de29 bade28 bddf26 c0df25
    c2df23 c5e021 c8e020 cae11f cde11d d0e11c d2e21b d5e21a
    d8e219 dae319 dde318 dfe318 e2e418 e5e419 e7e419 eae51a
    ece51b efe51c f1e51d f4e61e f6e620 f8e621 fbe723 fde725
  `.trim().split(/\s+/);
  const paletteColors = paletteHex.map(hex => new THREE.Color('#' + hex));

  // The GPU and encoding cells interpolate the same color samples.
  const paletteBytes = paletteHex.flatMap(hex => [
    parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16), 255
  ]);
  const palette = new THREE.DataTexture(new Uint8Array(paletteBytes), 256, 1);
  palette.colorSpace = THREE.SRGBColorSpace;
  palette.minFilter = palette.magFilter = THREE.LinearFilter;
  palette.needsUpdate = true;
  const color = new THREE.Color();

  // Each plane and encoding row share an example channel and a fixed color scale.
  const width = 3.8;
  const planeGeometry = new THREE.PlaneGeometry(width, width);
  planeGeometry.rotateX(Math.PI / 2);
  const dotGeometry = new THREE.SphereGeometry(0.09, 12, 8);
  const dotMaterial = new THREE.MeshBasicMaterial({
    color: 0xe34b4b, transparent: true, opacity: 0.8, depthTest: false
  });
  const stack = new THREE.Group();
  view.scene.add(stack);

  // The sampling line passes through every layer at the same physical location.
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0x656d73, transparent: true, opacity: 0.8, depthTest: false
  });
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 10.8, 8), lineMaterial);
  needle.renderOrder = 20;
  stack.add(needle);
  let layers = [];
  let dimensions = [];
  let currentStep = 0;

  // The stack shows examples from a larger encoding, with omitted fields between.
  const axis = document.createElement('span');
  axis.className = 'field-dimensions';
  axis.textContent = 'Dimensions';
  const ellipsis = document.createElement('span');
  ellipsis.className = 'field-ellipsis';
  ellipsis.textContent = '⋮';
  ellipsis.setAttribute('aria-hidden', 'true');
  view.host.append(axis, ellipsis);

  function sample(values, step) {
    const index = Math.floor(step);
    const next = Math.min(index + 1, values.length - 1);
    return values[index] + (values[next] - values[index]) * (step - index);
  }

  function material(channel) {
    const bytes = new Uint8Array(channel.field.map(value => Math.round(value * 255)));
    const texture = new THREE.DataTexture(bytes, data.side, data.side, THREE.RedFormat);
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    // Heading changes modulate the actual spatial field, rather than replacing it.
    return new THREE.ShaderMaterial({
      uniforms: { field: { value: texture }, gain: { value: 1 },
        texel: { value: 1 / data.side },
        palette: { value: palette } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying vec2 fieldUV;
        void main() {
          fieldUV = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `uniform sampler2D field;
        uniform float gain;
        uniform float texel;
        uniform sampler2D palette;
        varying vec2 fieldUV;
        void main() {
          vec2 sampleUV = fieldUV * (1.0 - texel) + texel * 0.5;
          float value = clamp(texture2D(field, sampleUV).r * gain, 0.0, 1.0);
          float paletteX = (value * 255.0 + 0.5) / 256.0;
          vec3 color = texture2D(palette, vec2(paletteX, 0.5)).rgb;
          gl_FragColor = vec4(color, 0.9);
          #include <colorspace_fragment>
        }`
    });
  }

  function select(mask) {
    // Round-robin selection gives each enabled modality an example before repeats.
    const active = data.families.filter(family => mask & family.bit);
    dimensions = Array.from({ length: 8 }, (_, index) => {
      const family = active[index % active.length];
      return { family, channel: family.channels[Math.floor(index / active.length)] };
    });
    const chosen = [0, 1, 2, 5, 6, 7].map(index => dimensions[index]);

    // Dispose replaced textures while retaining shared geometry and marker materials.
    layers.forEach(layer => {
      stack.remove(layer.mesh, layer.marker);
      layer.mesh.material.uniforms.field.value.dispose();
      layer.mesh.material.dispose();
    });
    layers = chosen.map(({ family, channel }, index) => {
      const y = [3.6, 2.65, 1.7, -1.7, -2.65, -3.6][index];
      const mesh = new THREE.Mesh(planeGeometry, material(channel));
      mesh.position.y = y;
      mesh.renderOrder = 6 - index;
      const marker = new THREE.Mesh(dotGeometry, dotMaterial);
      marker.position.y = y + 0.02;
      marker.renderOrder = 21;
      stack.add(mesh, marker);

      return { mesh, marker, channel, family, y };
    });
    sequence.setAttribute('aria-label', 'Recent encoding vectors, newest at right. ' +
      dimensions.map(({ family, channel }, index) => `Dimension ${index + 1}: ${family.label} ${channel.cell + 1}`).join('; '));
  }

  function drawSequence() {
    // Every column samples a continuous delay from the shared playback clock.
    const hostWidth = Math.max(sequence.clientWidth, 300);
    const scale = sequence.clientWidth / hostWidth;
    const hostHeight = sequence.clientHeight / scale;
    const ratio = Math.min(devicePixelRatio, 2) * scale;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const columns = 8, gap = 3, labelWidth = 32;
    const size = Math.min(22, (hostWidth - labelWidth - 16) / columns - gap);
    const totalWidth = labelWidth + columns * (size + gap);
    const left = Math.max(0, (hostWidth - totalWidth) / 2);
    const omissionHeight = 28;
    const matrixHeight = dimensions.length * (size + gap) + omissionHeight;
    // Center the matrix on the field stack; the history axis sits below it.
    const fieldCenter = new THREE.Vector3(0, 0, 0).project(view.camera);
    const centerY = (1 - fieldCenter.y) * hostHeight / 2;
    const top = centerY - matrixHeight / 2;
    context.clearRect(0, 0, hostWidth, hostHeight);
    context.font = `15px ${labelFont}`;
    context.textBaseline = 'middle';

    dimensions.forEach(({ channel }, row) => {
      const y = top + row * (size + gap) + (row >= 4 ? omissionHeight : 0);
      for (let column = 0; column < columns; column++) {
        const step = currentStep - (columns - 1 - column) * 4;
        const value = step < 0 ? 0 : sample(channel.trace, step);
        const palettePosition = Math.max(0, Math.min(value, 1)) * 255;
        const index = Math.min(Math.floor(palettePosition), 254);
        color.copy(paletteColors[index]).lerp(paletteColors[index + 1], palettePosition - index);
        context.fillStyle = color.getStyle();
        context.globalAlpha = step < 0 ? 0.25 : 0.9;
        context.fillRect(left + labelWidth + column * (size + gap), y, size, size);
      }
    });

    // One centered ellipsis marks the omitted dimensions across the sequence.
    context.globalAlpha = 1;
    context.fillStyle = '#68747b';
    const middleY = top + 4 * (size + gap) + omissionHeight / 2 - gap / 2;
    const middleX = left + labelWidth + (columns * (size + gap) - gap) / 2;
    for (const offset of [-5, 0, 5]) {
      context.beginPath();
      context.arc(middleX, middleY + offset, 1.1, 0, Math.PI * 2);
      context.fill();
    }

    // History travels left as new observations enter from the right.
    const baseline = top + matrixHeight + 13;
    const arrowLeft = left + labelWidth;
    const arrowRight = left + totalWidth - gap;
    context.strokeStyle = '#68747b';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(arrowLeft, baseline);
    context.lineTo(arrowRight, baseline);
    context.moveTo(arrowLeft + 5, baseline - 3);
    context.lineTo(arrowLeft, baseline);
    context.lineTo(arrowLeft + 5, baseline + 3);
    context.stroke();
    context.textAlign = 'center';
    context.fillText('History', (arrowLeft + arrowRight) / 2, baseline + 15);

    // Label the axis once instead of numbering individual example dimensions.
    context.save();
    context.translate(left + 7, top + matrixHeight / 2);
    context.rotate(-Math.PI / 2);
    context.textAlign = 'center';
    context.fillText('Dimensions', 0, 0);
    context.restore();
    sequence.dataset.step = currentStep.toFixed(3);
  }

  function update(step, position) {
    currentStep = step;
    needle.position.set(position.x * width / 10, 0, position.z * width / 10);
    layers.forEach(layer => {
      layer.marker.position.x = needle.position.x;
      layer.marker.position.z = needle.position.z;
      const gain = layer.channel.gain;
      layer.mesh.material.uniforms.gain.value = gain ? sample(gain, step) : 1;
    });

    // Place the omission marker in the gap between the two groups of fields.
    const anchor = new THREE.Vector3(0, 0, 0).project(view.camera);
    const x = (anchor.x + 1) * view.host.clientWidth / 2;
    const y = (1 - anchor.y) * view.host.clientHeight / 2;
    ellipsis.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    drawSequence();
  }

  // Keep the encoding cells sharp on high-DPI screens, including paused playback.
  const resize = new ResizeObserver(() => {
    const ratio = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(sequence.clientWidth * ratio);
    canvas.height = Math.round(sequence.clientHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawSequence();
  });
  resize.observe(sequence);
  window.addEventListener('pagehide', () => resize.disconnect());
  // Static picker maps use the same field values and palette as the population.
  function preview(family, target, recording) {
    // Pick an interior place field; heading responses use a polar tuning curve.
    const channel = family.channels[family.bit === 1 ? 1 : 0];
    if (family.bit === 16) {
      drawHeadingPreview(target, channel, recording);
      return;
    }

    target.width = target.height = data.side;
    const painter = target.getContext('2d');
    const pixels = painter.createImageData(data.side, data.side);
    channel.field.forEach((value, index) => {
      const entry = Math.round(Math.max(0, Math.min(1, value)) * 255);
      pixels.data.set(paletteBytes.slice(entry * 4, entry * 4 + 4), index * 4);
    });
    painter.putImageData(pixels, 0, 0);
  }
  return { select, update, preview };
}

function drawHeadingPreview(canvas, channel, recording) {
  // Bin recorded responses by the same movement heading used during export.
  const bins = Array.from({ length: 72 }, () => ({ sum: 0, count: 0 }));
  let heading = 0;
  recording.coords.slice(0, -1).forEach((point, index) => {
    const next = recording.coords[index + 1];
    const dr = next[0] - point[0], dc = next[1] - point[1];
    if (Math.hypot(dr, dc) > 1e-8) heading = Math.atan2(dc, dr);
    const bin = Math.floor((heading + Math.PI) / (2 * Math.PI) * 72) % 72;
    bins[bin].sum += channel.trace[index];
    bins[bin].count++;
  });

  // A quiet polar grid leaves the directional response visible at thumbnail size.
  canvas.width = canvas.height = 96;
  const context = canvas.getContext('2d');
  context.fillStyle = '#f0f2f3';
  context.fillRect(0, 0, 96, 96);
  context.strokeStyle = '#c3cbd0';
  context.lineWidth = 1.5;
  for (const radius of [20, 38]) {
    context.beginPath();
    context.arc(48, 48, radius, 0, 2 * Math.PI);
    context.stroke();
  }

  // Radius encodes the recorded normalized firing rate at each heading.
  context.beginPath();
  bins.forEach((bin, index) => {
    if (!bin.count) return;
    const angle = (index + 0.5) / 72 * 2 * Math.PI - Math.PI;
    const radius = 38 * bin.sum / bin.count;
    context.lineTo(48 + radius * Math.sin(angle), 48 - radius * Math.cos(angle));
  });
  context.closePath();
  context.fillStyle = '#397cb033';
  context.strokeStyle = '#397cb0';
  context.lineWidth = 3;
  context.fill();
  context.stroke();
}
