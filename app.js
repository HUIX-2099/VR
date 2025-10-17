// A-Frame custom components for interactions
(function () {
  const getRig = () => document.querySelector('#rig');
  const getCamera = () => document.querySelector('#camera');

  // Face the active camera each frame
  AFRAME.registerComponent('face-camera', {
    tick: function () {
      const cam = getCamera();
      if (!cam) return;
      const camWorldPos = new THREE.Vector3();
      cam.object3D.getWorldPosition(camWorldPos);
      this.el.object3D.lookAt(camWorldPos);
    }
  });

  // Auto walk: continuously move the rig forward in the camera's facing direction.
  AFRAME.registerComponent('auto-walk', {
    schema: {
      enabled: { default: true },
      speed: { default: 1.2 }, // meters per second
      vrOnly: { default: true },
      toggleOnClick: { default: true }
    },
    init: function () {
      this.walking = this.data.enabled;
      this._last = null;
      const sceneEl = this.el.sceneEl;
      const cam = document.querySelector('#camera');
      this._shouldRun = () => this.walking && (!this.data.vrOnly || sceneEl.is('vr-mode'));
      this._onClick = () => { if (this.data.toggleOnClick) this.walking = !this.walking; };
      sceneEl.addEventListener('click', this._onClick);
      this._getForward = () => {
        if (!cam) return new THREE.Vector3(0, 0, -1);
        const dir = new THREE.Vector3();
        cam.object3D.getWorldDirection(dir);
        dir.y = 0; // keep on ground plane
        if (dir.lengthSq() === 0) return new THREE.Vector3(0, 0, -1);
        dir.normalize();
        return dir;
      };
    },
    tick: function (time, dt) {
      if (!this._shouldRun()) return;
      const delta = Math.min(100, dt) / 1000; // cap large dt spikes
      const speed = this.data.speed;
      const fwd = this._getForward();
      const p = this.el.object3D.position;
      p.x += fwd.x * speed * delta;
      p.z += fwd.z * speed * delta;
    },
    remove: function () {
      this.el.sceneEl.removeEventListener('click', this._onClick);
    }
  });

  // Add hover visual feedback to any entity with a material
  AFRAME.registerComponent('hoverable', {
    schema: { emissiveHover: { type: 'color', default: '#ffd166' }, intensity: { type: 'number', default: 0.9 } },
    init: function () {
      this._onEnter = () => {
        this.el.classList.add('hotspot-hover');
        const mat = this.el.getAttribute('material') || {};
        this._prevEmissive = mat.emissive;
        this._prevIntensity = mat.emissiveIntensity;
        this.el.setAttribute('material', {
          emissive: this.data.emissiveHover,
          emissiveIntensity: this.data.intensity
        });
      };
      this._onLeave = () => {
        this.el.classList.remove('hotspot-hover');
        const next = {};
        if (this._prevEmissive != null) next.emissive = this._prevEmissive;
        if (this._prevIntensity != null) next.emissiveIntensity = this._prevIntensity;
        if (Object.keys(next).length) this.el.setAttribute('material', next);
      };
      this.el.addEventListener('mouseenter', this._onEnter);
      this.el.addEventListener('mouseleave', this._onLeave);
    },
    remove: function () {
      this.el.removeEventListener('mouseenter', this._onEnter);
      this.el.removeEventListener('mouseleave', this._onLeave);
    }
  });

  // Play a click sound from a global asset when clicked
  AFRAME.registerComponent('sound-on-click', {
    schema: { src: { default: '#clickSnd' }, volume: { default: 0.6 } },
    init: function () {
      // Attach a sound component that triggers on click
      if (!this.el.getAttribute('sound')) {
        this.el.setAttribute('sound', `src: ${this.data.src}; on: click; volume: ${this.data.volume}`);
      }
    }
  });

  // Teleport the player rig to a specified coordinate when clicked
  AFRAME.registerComponent('hotspot', {
    schema: { to: { type: 'vec3' }, smoothMs: { type: 'int', default: 350 } },
    init: function () {
      this._onClick = () => {
        const rig = getRig();
        if (!rig) return;
        const from = new THREE.Vector3().copy(rig.object3D.position);
        const to = new THREE.Vector3(this.data.to.x, this.data.to.y, this.data.to.z);
        if (!isFinite(to.x) || !isFinite(to.y) || !isFinite(to.z)) return;
        if (this.data.smoothMs <= 0) {
          rig.setAttribute('position', to);
          return;
        }
        // Smooth lerp
        const start = performance.now();
        const dur = this.data.smoothMs;
        const animate = (t) => {
          const now = performance.now();
          const k = Math.min(1, (now - start) / dur);
          const ease = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k; // easeInOut
          const cur = from.clone().lerp(to, ease);
          rig.object3D.position.copy(cur);
          if (k < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      };
      this.el.addEventListener('click', this._onClick);
    },
    remove: function () {
      this.el.removeEventListener('click', this._onClick);
    }
  });

  // Simple info card (panel + text) that faces camera and is interactable
  AFRAME.registerComponent('interactive-card', {
    schema: {
      title: { type: 'string', default: 'Info' },
      body: { type: 'string', default: 'Details go here.' },
      width: { type: 'number', default: 1.2 },
      height: { type: 'number', default: 0.6 },
      color: { type: 'color', default: '#1b1e23' },
      opacity: { type: 'number', default: 0.9 }
    },
    init: function () {
      const root = this.el;
      root.classList.add('interactable');

      const panel = document.createElement('a-entity');
      panel.setAttribute('geometry', `primitive: plane; width: ${this.data.width}; height: ${this.data.height}`);
      panel.setAttribute('material', `color: ${this.data.color}; opacity: ${this.data.opacity}`);
      panel.setAttribute('position', '0 0 0');
      panel.setAttribute('face-camera', '');

      const title = document.createElement('a-entity');
      title.setAttribute('text', `value: ${this.data.title}; align: center; color: #ffffff; width: ${this.data.width}`);
      title.setAttribute('position', `0 ${this.data.height / 4} 0.01`);

      const body = document.createElement('a-entity');
      body.setAttribute('text', `value: ${this.data.body}; align: center; color: #d1d5db; width: ${this.data.width * 0.95}`);
      body.setAttribute('position', `0 ${-this.data.height / 6} 0.01`);

      panel.appendChild(title);
      panel.appendChild(body);
      root.appendChild(panel);

      // Click feedback
      root.setAttribute('hoverable', '');
      root.setAttribute('sound-on-click', '');
    }
  });

  // Auto-enter VR on mobile where possible. If a gesture is required, show a tap overlay.
  AFRAME.registerComponent('auto-vr', {
    schema: { enabled: { default: true }, delayMs: { default: 200 } },
    init: function () {
      const sceneEl = this.el.sceneEl;
      const isMobile = AFRAME.utils.device.isMobile();
      if (!this.data.enabled || !isMobile) return;

      const tryEnter = () => {
        // If already in VR, nothing to do
        if (sceneEl.is('vr-mode')) return;
        // Attempt enterVR; will reject if a user gesture is required
        const ret = sceneEl.enterVR && sceneEl.enterVR();
        if (ret && typeof ret.then === 'function') {
          ret.then(() => cleanup(), () => showOverlay());
        } else {
          // Older A-Frame returns void; show overlay as fallback after short delay
          setTimeout(showOverlay, 300);
        }
      };

      let overlay;
      const cleanup = () => {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        overlay = null;
      };

      const showOverlay = () => {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.setAttribute('aria-label', 'Tap to enter VR');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(9, 11, 15, 0.92)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '9999';
        overlay.style.userSelect = 'none';
        overlay.style.webkitUserSelect = 'none';

        const btn = document.createElement('button');
        btn.textContent = 'Tap to enter VR';
        btn.style.fontSize = '20px';
        btn.style.padding = '16px 24px';
        btn.style.borderRadius = '12px';
        btn.style.border = '0';
        btn.style.color = '#0b0e14';
        btn.style.background = '#ffbd2e';
        btn.style.fontWeight = '700';
        btn.style.boxShadow = '0 10px 30px rgba(0,0,0,0.4)';
        btn.addEventListener('click', () => {
          const p = sceneEl.enterVR && sceneEl.enterVR();
          if (p && typeof p.then === 'function') p.then(() => cleanup());
          else cleanup();
        }, { once: true });

        overlay.appendChild(btn);
        document.body.appendChild(overlay);
      };

      // Defer slightly to allow XR initialization
      setTimeout(tryEnter, this.data.delayMs);

      // If the user enters VR by other means, remove overlay
      sceneEl.addEventListener('enter-vr', cleanup);
    }
  });

  AFRAME.registerComponent('vr-quality', {
    schema: {
      pixelRatioMultiplier: { default: 1.6 },
      maxPixelRatio: { default: 3 },
      anisotropy: { default: 16 },
      initialMultiplier: { default: 0.9 },
      rampOnModelLoaded: { default: true }
    },
    init: function () {
      const sceneEl = this.el.sceneEl;
      const renderer = sceneEl.renderer;
      const applyAniso = () => {
        sceneEl.object3D.traverse((obj) => {
          if (!obj.material) return;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach((k) => {
              if (m[k] && m[k].anisotropy != null) m[k].anisotropy = this.data.anisotropy;
            });
          });
        });
      };
      const setPR = () => {
        if (!renderer) return;
        const target = Math.min(window.devicePixelRatio * this.data.pixelRatioMultiplier, this.data.maxPixelRatio);
        renderer.setPixelRatio(target);
        try { renderer.xr.setFoveation && renderer.xr.setFoveation(0); } catch (e) {}
      };
      const setPRLow = () => {
        if (!renderer) return;
        const target = Math.min(window.devicePixelRatio * this.data.initialMultiplier, this.data.maxPixelRatio);
        renderer.setPixelRatio(target);
      };
      const onEnter = () => { setPR(); applyAniso(); };
      const onExit = () => { if (renderer) renderer.setPixelRatio(window.devicePixelRatio || 1); };
      sceneEl.addEventListener('enter-vr', onEnter);
      sceneEl.addEventListener('enter-ar', onEnter);
      sceneEl.addEventListener('exit-vr', onExit);
      this._cleanup = () => {
        sceneEl.removeEventListener('enter-vr', onEnter);
        sceneEl.removeEventListener('enter-ar', onEnter);
        sceneEl.removeEventListener('exit-vr', onExit);
      };
      // Start low during initial load for faster first contentful paint
      setPRLow();
      // Ramp to target once content is ready or when entering VR
      if (this.data.rampOnModelLoaded) {
        const bump = () => { setPR(); sceneEl.removeEventListener('model-loaded', bump); };
        sceneEl.addEventListener('model-loaded', bump);
      }
      if (sceneEl.is('vr-mode')) onEnter();
    },
    remove: function () { this._cleanup && this._cleanup(); }
  });

  AFRAME.registerComponent('comfort-mode', {
    schema: { snapAngle: { default: 30 }, accel: { default: 10 }, vignetteOpacity: { default: 0.35 } },
    init: function () {
      const sceneEl = this.el.sceneEl;
      const rig = getRig();
      const cam = getCamera();
      if (cam) {
        const vignette = document.createElement('a-entity');
        vignette.setAttribute('geometry', 'primitive: ring; radiusInner: 0.25; radiusOuter: 0.6; segmentsTheta: 64');
        vignette.setAttribute('material', `color: #000; opacity: ${this.data.vignetteOpacity}; transparent: true`);
        vignette.setAttribute('position', '0 0 -0.35');
        vignette.setAttribute('rotation', '0 0 0');
        vignette.setAttribute('visible', 'false');
        cam.appendChild(vignette);
        this._vignette = vignette;
      }
      if (rig) {
        const mover = rig.querySelector('[wasd-controls]') || rig;
        try { mover.setAttribute('wasd-controls', `acceleration: ${this.data.accel}`); } catch (e) {}
      }
      let cooldown = 0;
      const SNAP = THREE.MathUtils.degToRad(this.data.snapAngle);
      const trySnap = (dir) => {
        const now = performance.now();
        if (now < cooldown) return;
        cooldown = now + 180;
        if (!rig) return;
        const rot = rig.getAttribute('rotation');
        rig.setAttribute('rotation', `${rot.x} ${rot.y + (dir > 0 ? THREE.MathUtils.radToDeg(SNAP) : -THREE.MathUtils.radToDeg(SNAP))} ${rot.z}`);
      };
      this._onKey = (e) => {
        if (e.repeat) return;
        if (e.key === 'e' || e.key === 'E') trySnap(1);
        if (e.key === 'q' || e.key === 'Q') trySnap(-1);
      };
      this._onAxis = (e) => {
        const ax = (e.detail && e.detail.axis) || [];
        const x = ax[0] || 0;
        if (x > 0.8) trySnap(1);
        if (x < -0.8) trySnap(-1);
      };
      this._onEnterVR = () => { if (this._vignette) this._vignette.setAttribute('visible', 'true'); };
      this._onExitVR = () => { if (this._vignette) this._vignette.setAttribute('visible', 'false'); };
      window.addEventListener('keydown', this._onKey);
      sceneEl.addEventListener('axismove', this._onAxis);
      sceneEl.addEventListener('enter-vr', this._onEnterVR);
      sceneEl.addEventListener('exit-vr', this._onExitVR);
    },
    remove: function () {
      const sceneEl = this.el.sceneEl;
      window.removeEventListener('keydown', this._onKey);
      sceneEl.removeEventListener('axismove', this._onAxis);
      sceneEl.removeEventListener('enter-vr', this._onEnterVR);
      sceneEl.removeEventListener('exit-vr', this._onExitVR);
      if (this._vignette && this._vignette.parentNode) this._vignette.parentNode.removeChild(this._vignette);
    }
  });

  // Fullscreen loading overlay with percentage using THREE.DefaultLoadingManager
  AFRAME.registerComponent('loading-overlay', {
    schema: { text: { default: 'Loading…' }, autoHide: { default: true } },
    init: function () {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.background = '#0b0e14';
      overlay.style.display = 'flex';
      overlay.style.flexDirection = 'column';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.color = '#e5e7eb';
      overlay.style.fontFamily = 'system-ui, Segoe UI, Roboto, Helvetica, Arial';
      overlay.style.zIndex = '9998';

      const title = document.createElement('div');
      title.textContent = this.data.text;
      title.style.fontSize = '18px';
      title.style.marginBottom = '12px';

      const barWrap = document.createElement('div');
      barWrap.style.width = '66%';
      barWrap.style.maxWidth = '420px';
      barWrap.style.height = '8px';
      barWrap.style.background = '#1f2430';
      barWrap.style.borderRadius = '8px';
      barWrap.style.overflow = 'hidden';

      const bar = document.createElement('div');
      bar.style.height = '100%';
      bar.style.width = '0%';
      bar.style.background = '#ffbd2e';
      bar.style.transition = 'width 120ms linear';

      const pct = document.createElement('div');
      pct.textContent = '0%';
      pct.style.marginTop = '10px';
      pct.style.fontSize = '14px';
      pct.style.color = '#cbd5e1';

      barWrap.appendChild(bar);
      overlay.appendChild(title);
      overlay.appendChild(barWrap);
      overlay.appendChild(pct);
      document.body.appendChild(overlay);
      this._overlay = overlay;
      this._bar = bar;
      this._pct = pct;

      // Hook into Three.js loading manager
      const manager = THREE.DefaultLoadingManager;
      let itemsTotal = 0, itemsLoaded = 0;
      const update = () => {
        const p = itemsTotal ? Math.round((itemsLoaded / itemsTotal) * 100) : 0;
        this._bar.style.width = `${p}%`;
        this._pct.textContent = `${p}%`;
      };
      manager.onStart = (_url, loaded, total) => { itemsLoaded = loaded; itemsTotal = total; update(); };
      manager.onProgress = (_url, loaded, total) => { itemsLoaded = loaded; itemsTotal = total; update(); };
      manager.onError = (_url) => {};
      manager.onLoad = () => {
        if (this.data.autoHide) {
          setTimeout(() => {
            if (this._overlay && this._overlay.parentNode) this._overlay.parentNode.removeChild(this._overlay);
            this._overlay = null;
          }, 150);
        }
      };
    },
    remove: function () {
      if (this._overlay && this._overlay.parentNode) this._overlay.parentNode.removeChild(this._overlay);
    }
  });

  // Defer GLTF loading until after scene has initialized. Optional Draco/KTX2 support.
  AFRAME.registerComponent('lazy-gltf', {
    schema: {
      src: { type: 'string' },
      dracoDecoderPath: { type: 'string', default: '' },
      ktx2TranscoderPath: { type: 'string', default: '' }
    },
    init: function () {
      this.el.setAttribute('visible', 'false');
      const sceneEl = this.el.sceneEl;
      const doLoad = () => {
        const parts = [];
        if (this.data.dracoDecoderPath) parts.push(`dracoDecoderPath: ${this.data.dracoDecoderPath}`);
        if (this.data.ktx2TranscoderPath) parts.push(`ktx2TranscoderPath: ${this.data.ktx2TranscoderPath}`);
        parts.push(`src: url(${this.data.src})`);
        this.el.setAttribute('gltf-model', parts.join('; '));
        this.el.addEventListener('model-loaded', () => {
          this.el.setAttribute('visible', 'true');
        }, { once: true });
      };
      if (sceneEl.hasLoaded) doLoad();
      else sceneEl.addEventListener('loaded', doLoad, { once: true });
    }
  });
})();
