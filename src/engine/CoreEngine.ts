/**
 * Core Engine combining:
 * 1. Lotus Nexus: Orchestration Core & State Machine (Event Bus)
 * 2. Plasma Script: Dynamic Visual Rendering
 * 3. Apop Scripts: Creative trigger events & interactions
 */

export type EventCallback = (payload?: any) => void;

// ==========================================
// 1. LOTUS NEXUS (Orchestration & State)
// ==========================================
export class LotusNexus {
  private events: Map<string, EventCallback[]> = new Map();
  private state: Record<string, any> = {};

  constructor(initialState: Record<string, any> = {}) {
    this.state = { ...initialState };
  }

  // Event Bus
  on(event: string, callback: EventCallback) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback) {
    if (!this.events.has(event)) return;
    const callbacks = this.events.get(event)!.filter(cb => cb !== callback);
    this.events.set(event, callbacks);
  }

  emit(event: string, payload?: any) {
    if (this.events.has(event)) {
      this.events.get(event)!.forEach(cb => cb(payload));
    }
  }

  // State Machine
  setState(key: string, value: any) {
    this.state[key] = value;
    this.emit(`state:${key}`, value);
    this.emit('state:change', this.state);
  }

  getState(key: string) {
    return this.state[key];
  }

  getFullState() {
    return { ...this.state };
  }
}

// ==========================================
// 2. TV ENGINE RADIO (Broadcast Pipeline)
// ==========================================
export class TVEngineRadio {
  private nexus: LotusNexus;
  private animationFrameId: number = 0;
  private isBroadcasting: boolean = false;
  private lastPeakTime: number = 0;

  // Audio Context & Nodes
  private audioElement: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private source: MediaElementAudioSourceNode | null = null;

  private bands = { bass: 0, mids: 0, highs: 0 };
  private smoothing = 0.85;

  constructor(nexus: LotusNexus, audioElement: HTMLAudioElement) {
    this.nexus = nexus;
    this.audioElement = audioElement;
  }

  private initAudio() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.source = this.ctx.createMediaElementSource(this.audioElement);
    this.source.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  public toggleBroadcast() {
    if (this.isBroadcasting) {
      this.stop();
    } else {
      this.start();
    }
  }

  public start() {
    if (this.isBroadcasting) return;
    this.isBroadcasting = true;
    this.nexus.setState('radio:active', true);
    
    this.initAudio();
    if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
    }
    
    // Play the audio element, catch and ignore block promises if user hasn't loaded track
    this.audioElement.play().catch(() => {});
    
    const loop = () => {
      this.processStream();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    this.nexus.emit('radio:started');
  }

  public stop() {
    if (!this.isBroadcasting) return;
    this.isBroadcasting = false;
    cancelAnimationFrame(this.animationFrameId);
    this.audioElement.pause();
    this.nexus.setState('radio:active', false);
    this.nexus.setState('radio:volume', 0);
    this.nexus.setState('radio:bass', 0);
    this.nexus.emit('radio:stopped');
  }

  public getFrequencyData(): Uint8Array | null {
    return this.dataArray;
  }

  private processStream() {
    if (!this.analyser || !this.dataArray) return;
    this.analyser.getByteFrequencyData(this.dataArray);
    
    const getAverageBin = (low: number, high: number) => {
        let sum = 0;
        for (let i = low; i <= high; i++) {
          sum += this.dataArray![i];
        }
        return (sum / (high - low + 1)) / 255.0; // Normalized 0.0 to 1.0
    };

    const rawBass = getAverageBin(0, 10);      // ~20Hz - 250Hz
    const rawMids = getAverageBin(11, 150);    // ~250Hz - 4kHz
    const rawHighs = getAverageBin(151, 255);  // ~4kHz - 20kHz

    // Exponential smoothing for fluid transitions
    this.bands.bass = (this.bands.bass * this.smoothing) + (rawBass * (1 - this.smoothing));
    this.bands.mids = (this.bands.mids * this.smoothing) + (rawMids * (1 - this.smoothing));
    this.bands.highs = (this.bands.highs * this.smoothing) + (rawHighs * (1 - this.smoothing));

    const volume = (this.bands.bass * 0.6) + (this.bands.mids * 0.4);

    this.nexus.setState('radio:volume', volume);
    this.nexus.setState('radio:bass', this.bands.bass);
    this.nexus.setState('radio:mids', this.bands.mids);
    this.nexus.setState('radio:highs', this.bands.highs);
  }
}

// ==========================================
// 3. PLASMA SCRIPT (Visual Rendering)
// ==========================================
export interface PlasmaConfig {
  canvas: HTMLCanvasElement;
  nexus: LotusNexus;
}

export class PlasmaEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nexus: LotusNexus;
  private animationFrameId: number = 0;
  private particles: Array<{ x: number, y: number, vx: number, vy: number, life: number, maxLife: number, color: string, size: number }> = [];
  
  private width: number = 0;
  private height: number = 0;

  // Shader Uniform Equivalents
  private uniforms = {
    u_time: { value: 0 },
    u_scale: { value: 1.0 },
    u_noise: { value: 0 }
  };

  constructor(config: PlasmaConfig) {
    this.canvas = config.canvas;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get 2D context");
    this.ctx = ctx;
    this.nexus = config.nexus;
    
    this.resize = this.resize.bind(this);
    this.resize();

    window.addEventListener('resize', this.resize);

    // Bind to Nexus Events
    this.nexus.on('apop:burst', (payload) => this.createBurst(payload.x, payload.y, payload.color));
    this.nexus.on('apop:clear', () => { this.particles = []; });
    this.nexus.on('apop:resize', () => { this.resize(); });
  }

  private resize() {
    this.width = this.canvas.parentElement?.clientWidth || window.innerWidth;
    this.height = this.canvas.parentElement?.clientHeight || window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  public start() {
    const loop = () => {
      this.update();
      this.draw();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    this.nexus.emit('plasma:started');
  }

  public stop() {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.resize);
    this.nexus.emit('plasma:stopped');
  }

  private createBurst(x: number, y: number, color: string) {
    const intensity = this.nexus.getState('intensity') || 1;
    const count = Math.floor(Math.random() * 20 + 30) * intensity;
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 * intensity + 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: Math.random() * 60 + 40,
        color: color || `hsl(${Math.random() * 360}, 80%, 60%)`,
        size: Math.random() * 4 * intensity + 1
      });
    }
  }

  private update() {
    const radioActive = this.nexus.getState('radio:active');
    const mids = radioActive ? (this.nexus.getState('radio:mids') || 0) : 0;
    const bass = radioActive ? (this.nexus.getState('radio:bass') || 0) : 0;
    const highs = radioActive ? (this.nexus.getState('radio:highs') || 0) : 0;

    // Direct uniform injection (mapped via exponential smoothing from TV Engine Radio)
    this.uniforms.u_time.value += 0.01 + (mids * 0.05); // Speed modulated by Mids
    this.uniforms.u_scale.value = 1.0 + (bass * 1.5);    // Pulse size by Bass
    this.uniforms.u_noise.value = highs * 2.0;           // Crispness by Highs

    const gravity = this.nexus.getState('gravity') || 0;
    const baseFriction = this.nexus.getState('friction') || 0.98;
    const friction = baseFriction - (bass * 0.02); // Let bass loosen the friction

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Inject noise uniformly based on Highs
      const noiseX = (Math.random() - 0.5) * this.uniforms.u_noise.value;
      const noiseY = (Math.random() - 0.5) * this.uniforms.u_noise.value;

      p.vy += gravity + noiseY;
      p.vx += noiseX;
      
      p.vx *= friction;
      p.vy *= friction;
      
      // Modulate speed by u_time velocity multiplier conceptually
      p.x += p.vx * (1 + mids * 0.5);
      p.y += p.vy * (1 + mids * 0.5);
      
      p.life++;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }

  private draw() {
    const trailLength = this.nexus.getState('trailLength') || 0.2;
    this.ctx.fillStyle = `rgba(10, 10, 15, ${trailLength})`;
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.globalCompositeOperation = 'lighter';
    
    for (const p of this.particles) {
      const progress = p.life / p.maxLife;
      const opacity = 1 - progress;
      
      this.ctx.beginPath();
      // Apply u_scale uniform for dynamic size blooming
      this.ctx.arc(p.x, p.y, p.size * (1 - progress) * this.uniforms.u_scale.value, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = opacity;
      this.ctx.fill();
    }
    
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
  }
}

// ==========================================
// 4. APOP SCRIPTS (Hooks & Triggers)
// ==========================================
export class ApopScripts {
  private nexus: LotusNexus;
  private element: HTMLElement | null = null;
  private lastSpikeTime: number = 0;
  
  private handlers = {
      click: (e: MouseEvent) => this.handleClick(e),
      mousemove: (e: MouseEvent) => this.handleMouseMove(e),
      keydown: (e: KeyboardEvent) => this.handleKeyDown(e),
      radioBassMonitor: (bass: number) => this.monitorAudioSpikes(bass)
  };

  constructor(nexus: LotusNexus) {
    this.nexus = nexus;
  }

  public registerHooks(element: HTMLElement) {
    this.element = element;
    element.addEventListener('mousedown', this.handlers.click);
    element.addEventListener('mousemove', this.handlers.mousemove);
    window.addEventListener('keydown', this.handlers.keydown);
    
    // Monitor audio frequencies for sudden spikes
    this.nexus.on('state:radio:bass', this.handlers.radioBassMonitor);
  }
  
  public unregisterHooks() {
      if (this.element) {
          this.element.removeEventListener('mousedown', this.handlers.click);
          this.element.removeEventListener('mousemove', this.handlers.mousemove);
      }
      window.removeEventListener('keydown', this.handlers.keydown);
      this.nexus.off('state:radio:bass', this.handlers.radioBassMonitor);
  }

  private monitorAudioSpikes(bass: number) {
    const now = performance.now();
    // Monitor for sudden spikes > 0.9 threshold
    if (bass > 0.9 && (now - this.lastSpikeTime > 400)) {
        this.lastSpikeTime = now;
        if (!this.element) return;
        
        const rect = this.element.getBoundingClientRect();
        
        // Automatically trigger 'apop:burst' for visual impact beats
        this.nexus.emit('apop:burst', { 
            x: rect.width * (0.1 + Math.random() * 0.8), 
            y: rect.height * (0.1 + Math.random() * 0.8), 
            color: this.getRandomColor(),
        });

        // Dynamic State Shift (Gravity Inversion) on extreme impact
        if (bass > 0.92) {
            const currentGravity = this.nexus.getState('gravity') || 0.1;
            this.nexus.setState('gravity', -currentGravity);
            setTimeout(() => {
                this.nexus.setState('gravity', currentGravity);
            }, 300);
        }
    }
  }

  private handleClick(e: MouseEvent) {
    if (!this.element) return;
    const rect = this.element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.nexus.emit('apop:burst', { x, y, color: this.getRandomColor() });
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.element) return;
    if (e.buttons > 0) {
      const rect = this.element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (Math.random() > 0.3) {
          this.nexus.emit('apop:burst', { x, y, color: this.getRandomColor() });
      }
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space') {
      this.nexus.emit('apop:clear');
      e.preventDefault();
    }
    if (e.code === 'ArrowUp') {
      const currentIntensity = this.nexus.getState('intensity') || 1;
      this.nexus.setState('intensity', Math.min(3, currentIntensity + 0.2));
      e.preventDefault();
    }
    if (e.code === 'ArrowDown') {
       const currentIntensity = this.nexus.getState('intensity') || 1;
       this.nexus.setState('intensity', Math.max(0.2, currentIntensity - 0.2));
       e.preventDefault();
    }
  }

  private getRandomColor(): string {
    const palette = this.nexus.getState('palette') || ['#00f0ff', '#ff003c', '#d600ff', '#00ff73'];
    return palette[Math.floor(Math.random() * palette.length)];
  }
}

// ==========================================
// EXPLICIT INITIALIZATION CALL
// ==========================================
export function initializeEngine(canvasElement: HTMLCanvasElement, containerElement: HTMLElement, audioElement: HTMLAudioElement) {
  // 1. Initialize Nexus (Orchestration Core)
  const nexus = new LotusNexus({
    intensity: 1.0,
    gravity: 0.1,
    friction: 0.98,
    trailLength: 0.2,
    palette: ['#00f0ff', '#ff003c', '#d600ff', '#00ff73', '#ffcf00']
  });

  // 2. Initialize TV Engine Radio (Broadcast Pipeline)
  const radio = new TVEngineRadio(nexus, audioElement);

  // 3. Initialize Plasma (Rendering)
  const plasma = new PlasmaEngine({ canvas: canvasElement, nexus });
  plasma.start();

  // 4. Initialize Apop (Triggers)
  const apop = new ApopScripts(nexus);
  apop.registerHooks(containerElement);

  console.log("Lotus Nexus Engine Initialized Successfully.");
  return { nexus, plasma, apop, radio };
}
