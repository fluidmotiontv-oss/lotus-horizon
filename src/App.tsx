/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { initializeEngine, LotusNexus } from './engine/CoreEngine';
import SpectrumVisualizer from './components/SpectrumVisualizer';
import { Settings, Info, Save, Bookmark, Trash2, Radio } from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<{ nexus: LotusNexus, plasma: any, apop: any, radio: any } | null>(null);

  const [audioSrc, setAudioSrc] = useState<string>('');
  const [intensity, setIntensity] = useState(1);
  const [gravity, setGravity] = useState(0.1);
  const [radioActive, setRadioActive] = useState(false);
  const [radioVolume, setRadioVolume] = useState(0);

  const [presets, setPresets] = useState<{id: string, name: string, state: any}[]>([
    { id: 'p1', name: 'Zen Drift', state: { intensity: 0.8, gravity: 0.05 } },
    { id: 'p2', name: 'Hyper Storm', state: { intensity: 3.0, gravity: 0.3 } },
    { id: 'p3', name: 'Anti-Gravity', state: { intensity: 1.5, gravity: -0.1 } }
  ]);
  const [newPresetName, setNewPresetName] = useState('');

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !audioRef.current) return;

    // Explicit Initialization of the Engine
    const engine = initializeEngine(canvasRef.current, containerRef.current, audioRef.current);
    engineRef.current = engine;

    // Listen to Nexus State Changes
    const onStateChange = (state: any) => {
      setIntensity(state.intensity);
      setGravity(state.gravity);
      setRadioActive(state['radio:active'] || false);
      setRadioVolume(state['radio:volume'] || 0);
    };
    engine.nexus.on('state:change', onStateChange);

    // Add a resize listener specifically to clear and resize canvas properly via apop hook
    const handleResize = () => {
        engine.nexus.emit('apop:resize');
    };
    window.addEventListener('resize', handleResize);

    return () => {
      engine.plasma.stop();
      engine.apop.unregisterHooks();
      engine.nexus.off('state:change', onStateChange);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    engineRef.current?.nexus.setState('intensity', val);
  };

  const handleGravityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    engineRef.current?.nexus.setState('gravity', val);
  };

  const handleSavePreset = () => {
    if (!engineRef.current || !newPresetName.trim()) return;
    const currentState = engineRef.current.nexus.getFullState();
    const newPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      state: { intensity: currentState.intensity, gravity: currentState.gravity }
    };
    setPresets(prev => [...prev, newPreset]);
    setNewPresetName('');
  };

  const handleLoadPreset = (presetState: any) => {
    if (!engineRef.current) return;
    engineRef.current.nexus.setState('intensity', presetState.intensity);
    engineRef.current.nexus.setState('gravity', presetState.gravity);
  };
  
  const handleDeletePreset = (id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id));
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioSrc(url);
      
      // Auto-start radio when file is loaded if it was off
      if (!radioActive && engineRef.current) {
          engineRef.current.radio.start();
      }
    }
  };

  const triggerBurst = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      engineRef.current?.nexus.emit('apop:burst', { 
          x: rect.width / 2, 
          y: rect.height / 2,
          color: '#ffffff'
      });
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden text-slate-100 font-sans" ref={containerRef}>
      {/* Hidden Audio Element for TV Engine Radio */}
      <audio 
        ref={audioRef} 
        src={audioSrc} 
        crossOrigin="anonymous" 
        onEnded={() => engineRef.current?.radio.stop()} 
        loop
      />

      {/* Plasma Render Target */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
      />

      {/* Lotus UI Layer */}
      <div className="absolute top-0 left-0 w-full p-6 pointer-events-none flex justify-between items-start z-10">
        <div>
          <h1 className="text-2xl font-light tracking-widest uppercase mb-1">Lotus Nexus</h1>
          <p className="text-sm text-slate-400 max-w-sm">
            Orchestration Core running <span className="text-cyan-400">Plasma</span> engine.
            Interact to trigger <span className="text-fuchsia-400">Apop</span> hooks.
          </p>
        </div>

        <div className="pointer-events-auto bg-slate-900/50 backdrop-blur-md p-4 rounded-xl border border-slate-800/50 min-w-[240px]">
          <div className="flex items-center gap-2 mb-4 text-slate-300">
            <Settings size={16} />
            <span className="text-sm uppercase tracking-wider font-semibold">Nexus State</span>
          </div>

          <div className="space-y-4">
            {/* TV Engine Radio Panel */}
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2 text-slate-300 text-xs uppercase font-semibold">
                        <Radio size={14} className={radioActive ? "text-fuchsia-400 animate-pulse" : "text-slate-500"} />
                        <span>TV Engine Radio</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded transition-colors font-mono cursor-pointer text-slate-300">
                            LOAD
                            <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                        </label>
                        <button 
                            onClick={() => engineRef.current?.radio.toggleBroadcast()}
                            className={`text-xs px-2 py-1 rounded transition-colors font-mono cursor-pointer ${radioActive ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'}`}
                        >
                            {radioActive ? 'STOP' : 'START'}
                        </button>
                    </div>
                </div>
                
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-all duration-75"
                        style={{ width: `${Math.min(100, radioVolume * 100)}%` }}
                    />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-slate-500 font-mono">
                    <span>SIG_LVL</span>
                    <span>{(radioVolume * 100).toFixed(0)}%</span>
                </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-400">Intensity</span>
                <span className="font-mono">{intensity.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                min="0.2" max="3" step="0.1"
                value={intensity}
                onChange={handleIntensityChange}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-400">Gravity</span>
                <span className="font-mono">{gravity.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                min="-0.5" max="0.5" step="0.05"
                value={gravity}
                onChange={handleGravityChange}
                className="w-full accent-fuchsia-500 cursor-pointer"
              />
            </div>

            <button 
                onClick={triggerBurst}
                className="w-full mt-4 py-2 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-sm transition-colors uppercase tracking-wider font-medium cursor-pointer"
            >
                Trigger Core Burst
            </button>
          </div>

          {/* Preset Management */}
          <div className="mt-6 border-t border-slate-800 pt-4">
            <div className="flex items-center gap-2 mb-4 text-slate-300">
              <Bookmark size={16} />
              <span className="text-sm uppercase tracking-wider font-semibold">Presets</span>
            </div>
            
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Preset Name"
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
              />
              <button 
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed p-1.5 rounded transition-colors text-white cursor-pointer"
                title="Save Preset"
              >
                <Save size={18} />
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {presets.map(preset => (
                <div key={preset.id} className="flex items-center justify-between group bg-slate-900 border border-slate-800 p-2 rounded hover:border-slate-600 transition-colors">
                  <button 
                    onClick={() => handleLoadPreset(preset.state)}
                    className="flex-1 text-left text-sm text-slate-300 hover:text-white truncate cursor-pointer"
                  >
                    {preset.name}
                  </button>
                  <button 
                    onClick={() => handleDeletePreset(preset.id)}
                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-1"
                    title="Delete Preset"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {presets.length === 0 && (
                <div className="text-xs text-slate-500 text-center py-2">No saved presets.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Spectrum Visualizer mapped from Audio FFT */}
      <SpectrumVisualizer engineRef={engineRef} />

      {/* Interactions Hints */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none flex gap-4 text-xs text-slate-500 font-mono z-20">
          <span className="bg-slate-900/80 px-3 py-1.5 rounded-full backdrop-blur-sm border border-slate-800 shadow-sm">CLICK / DRAG</span>
          <span className="bg-slate-900/80 px-3 py-1.5 rounded-full backdrop-blur-sm border border-slate-800 shadow-sm">SPACE to clear</span>
          <span className="bg-slate-900/80 px-3 py-1.5 rounded-full backdrop-blur-sm border border-slate-800 shadow-sm">ARROWS up/down</span>
      </div>
    </div>
  );
}

