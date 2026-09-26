"use strict";

(() => {
  // Load and play navigation clips only while visible, respecting reduced motion.
  const navigation = [...document.querySelectorAll('.navigation-video')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const visibleClips = new Set();
  function updateNavigation() {
    navigation.forEach(video => {
      if (!visibleClips.has(video) || document.hidden || reducedMotion.matches) {
        video.pause();
        return;
      }

      // Retain the current position when returning to a previously loaded clip.
      if (!video.src) video.src = video.dataset.src;
      video.play().catch(() => {});
    });
  }

  const navigationObserver = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) visibleClips.add(target);
      else visibleClips.delete(target);
    });
    updateNavigation();
  });
  navigation.forEach(video => navigationObserver.observe(video));
  document.addEventListener('visibilitychange', updateNavigation);
  reducedMotion.addEventListener('change', updateNavigation);

  // Pair the camera and trajectory recordings, loading only visible rooms.
  const roomPairs = [...document.querySelectorAll('.realistic-pair')];
  const lightbox = document.querySelector('.room-lightbox');
  const lightboxContent = lightbox.querySelector('.room-lightbox-content');
  const visiblePairs = new Set();
  let enlargedPair = null;
  let placeholder = null;

  function updateGallery() {
    roomPairs.forEach(pair => {
      const videos = [...pair.querySelectorAll('video')];
      const active = enlargedPair ? pair === enlargedPair : visiblePairs.has(pair);
      if (document.hidden || !active) {
        videos.forEach(video => video.pause());
        return;
      }

      // Wait for both views so the pair starts from the same recorded moment.
      videos.forEach(video => {
        if (video.src) return;
        video.muted = true;
        video.preload = 'auto';
        video.src = video.dataset.src;
        video.load();
      });
      if (!videos.every(video => video.readyState >= 3)) {
        videos.forEach(video => video.pause());
        return;
      }
      videos.forEach(video => video.play().catch(() => {}));
    });
  }

  roomPairs.forEach(pair => {
    const camera = pair.querySelector('.realistic-camera');
    const trajectory = pair.querySelector('.realistic-trajectory');
    // Correct decoder drift and loop boundaries against the camera's timeline.
    camera.addEventListener('timeupdate', () => {
      if (camera.paused || trajectory.readyState < 2) return;
      if (Math.abs(camera.currentTime - trajectory.currentTime) > 0.1) {
        trajectory.currentTime = camera.currentTime;
      }
    });
    [camera, trajectory].forEach(video => {
      video.addEventListener('canplay', updateGallery);
      video.addEventListener('waiting', () => {
        camera.pause();
        trajectory.pause();
      });
    });
  });

  // Move the actual pair into the dialog without reloading its video sources.
  roomPairs.forEach(pair => pair.querySelector('.realistic-videos').addEventListener('click', () => {
    if (enlargedPair) return;
    enlargedPair = pair;
    placeholder = document.createElement('div');
    placeholder.style.height = `${pair.getBoundingClientRect().height}px`;
    pair.replaceWith(placeholder);
    lightboxContent.append(pair);
    pair.querySelector('.realistic-videos').disabled = true;
    lightbox.querySelector('h3').textContent = pair.querySelector('h3').textContent;
    lightbox.showModal();
    document.body.classList.add('room-lightbox-open');
    updateGallery();
  }));

  // Closing restores the gallery slot and keyboard focus at the current time.
  lightbox.addEventListener('close', () => {
    if (!enlargedPair) return;
    const pair = enlargedPair;
    placeholder.replaceWith(pair);
    enlargedPair = placeholder = null;
    const trigger = pair.querySelector('.realistic-videos');
    trigger.disabled = false;
    document.body.classList.remove('room-lightbox-open');
    trigger.focus({ preventScroll: true });
    updateGallery();
  });

  // Native dialog behavior handles Escape and traps focus while enlarged.
  lightbox.querySelector('.room-lightbox-close').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', event => {
    if (event.target !== lightbox) return;
    const bounds = lightbox.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside) lightbox.close();
  });
  document.addEventListener('visibilitychange', updateGallery);

  const roomObserver = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) visiblePairs.add(target);
      else visiblePairs.delete(target);
    });
    updateGallery();
  }, { threshold: 0.1 });
  roomPairs.forEach(pair => roomObserver.observe(pair));
  updateGallery();

  // Measure the static stages so arrows remain attached as the layout resizes.
  const pipeline = document.querySelector('.pipeline-diagram');
  function drawPipelineConnections() {
    if (!pipeline) return;
    const bounds = pipeline.getBoundingClientRect();
    const svg = pipeline.querySelector('.pipeline-connections');
    const paths = svg.querySelector('.pipeline-paths');
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    paths.replaceChildren();

    // Coordinates are local to the diagram, including when it is scrolled.
    const nodes = {};
    pipeline.querySelectorAll('[data-pipeline-node]').forEach(element => {
      const rect = element.getBoundingClientRect();
      nodes[element.dataset.pipelineNode] = {
        left: rect.left - bounds.left, right: rect.right - bounds.left,
        top: rect.top - bounds.top, bottom: rect.bottom - bounds.top,
        x: rect.left - bounds.left + rect.width / 2,
        y: rect.top - bounds.top + rect.height / 2,
      };
    });

    // Build simple SVG paths without introducing an animation or rendering loop.
    function arrow(d, optional = false) {
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', d);
      path.setAttribute('marker-end', 'url(#pipeline-arrowhead)');
      if (optional) path.classList.add('optional-path');
      paths.append(path);
      return path;
    }
    function label(text, x, y) {
      const node = document.createElementNS(svg.namespaceURI, 'text');
      node.setAttribute('x', x);
      node.setAttribute('y', y);
      node.textContent = text;
      paths.append(node);
      return node;
    }

    // The captured images pass through the encoder into feature vectors.
    ['simulation', 'camera', 'encoder'].forEach((name, index) => {
      const source = nodes[name];
      const target = nodes[['camera', 'encoder', 'encoding'][index]];
      const start = source.right + (name === 'camera' ? 24 : 6);
      arrow(`M${start} ${source.y} L${target.left - 7} ${target.y}`);
    });

    // Fan out to independent models; reconstruction is a separate optional branch.
    const encoding = nodes.encoding;
    const branchX = (encoding.right + nodes.world.left) / 2;
    ['world', 'neural'].forEach(name => {
      const target = nodes[name];
      arrow(`M${encoding.right + 7} ${encoding.y} H${branchX} V${target.y} H${target.left - 7}`);
    });
    const decoder = nodes.decoder;
    arrow(`M${encoding.x} ${encoding.top - 7} V24 H${decoder.x} V${decoder.top - 8}`, true);
    label('Optional decoding', (encoding.x + decoder.x) / 2, 15);

    // The world model provides input to a separate, externally supplied policy.
    const world = nodes.world;
    const policy = nodes.policy;
    arrow(`M${policy.x} ${world.bottom + 4} V${policy.top - 5}`);

    // Policy actions return to the simulation beneath the diagram.
    const simulation = nodes.simulation;
    const returnX = policy.right + 18;
    const returnY = bounds.height - 22;
    const entryX = simulation.left + 20;
    const actionPath = arrow(`M${policy.right + 6} ${policy.y} H${returnX} V${returnY} H${entryX} V${simulation.bottom + 8}`);
    actionPath.classList.add('action-path');

    // Typeset the action vector with a proper time subscript.
    const actionLabel = label('a', (simulation.x + returnX) / 2, returnY - 12);
    actionLabel.classList.add('math-label');
    const subscript = document.createElementNS(svg.namespaceURI, 'tspan');
    subscript.setAttribute('baseline-shift', 'sub');
    subscript.setAttribute('font-size', '65%');
    subscript.textContent = 't';
    actionLabel.append(subscript);
  }

  // Image decoding and font loading can change endpoints without a window resize.
  if (pipeline) {
    const observer = new ResizeObserver(drawPipelineConnections);
    observer.observe(pipeline);
    pipeline.querySelectorAll('[data-pipeline-node]').forEach(node => observer.observe(node));
    document.fonts.ready.then(drawPipelineConnections);
    drawPipelineConnections();
  }

  // Reveal sections as they enter view, while preserving normal page scrolling.
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.intersectionRatio >= 0.08) entry.target.classList.add('is-visible');
    }), { threshold: 0.08 });

    // Reset beyond the viewport, leaving room for the 24px reveal translation.
    // Separate enter/exit boundaries prevent flicker near the scrolling edge.
    const reset = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) entry.target.classList.remove('is-visible');
    }), { rootMargin: '80px 0px' });

    // Replaying the visual transition never reloads or reinitializes the demos.
    document.querySelectorAll('.section-heading, .trajectory-examples, .encoding-explanation, .neural-demo, .realistic-gallery, .vision-pipeline, .mesh-encoding-demo, .home-next').forEach(section => {
      section.classList.add('reveal-section');
      observer.observe(section);
      reset.observe(section);
    });
  }
})();
