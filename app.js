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
})();
