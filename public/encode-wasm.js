// In-browser video encoding with ffmpeg.wasm (vendored in ./vendor/ffmpeg).
// Lets the app export ProRes 4444 / QuickTime Animation .mov files with alpha
// without any server: everything runs on the user's own machine.
import { FFmpeg } from './vendor/ffmpeg/index.js';
import { log } from './log.js';

let ffmpeg = null;
let loading = null;
const tail = [];

export function loadEncoder() {
  if (ffmpeg) return Promise.resolve(ffmpeg);
  if (!loading) {
    loading = (async () => {
      const t0 = performance.now();
      const ff = new FFmpeg();
      ff.on('log', ({ message }) => { tail.push(message); if (tail.length > 40) tail.shift(); });
      const base = new URL('./vendor/ffmpeg/', import.meta.url).href;
      await ff.load({ coreURL: `${base}ffmpeg-core.js`, wasmURL: `${base}ffmpeg-core.wasm` });
      log('info', 'encoder.loaded', { seconds: +((performance.now() - t0) / 1000).toFixed(1) });
      ffmpeg = ff;
      return ff;
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

const CODECS = {
  prores: ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0'],
  qtrle: ['-c:v', 'qtrle', '-pix_fmt', 'argb'],
};

/**
 * Encode PNG frames into a .mov.
 * @param {object} o
 * @param {number} o.count number of frames
 * @param {(n:number)=>Promise<Uint8Array>} o.frame returns PNG bytes for frame n
 * @param {string} o.rate ffmpeg frame rate, e.g. '25' or '30000/1001'
 * @param {'prores'|'qtrle'} o.format
 * @param {(p:number, msg:string)=>void} o.onProgress
 */
export async function encodeMov({ count, frame, rate, format, onProgress }) {
  onProgress(0, 'Loading the video encoder (first time only)…');
  const ff = await loadEncoder();
  const names = [];
  try {
    for (let n = 0; n < count; n++) {
      const name = `f_${String(n).padStart(6, '0')}.png`;
      await ff.writeFile(name, await frame(n));
      names.push(name);
      onProgress(((n + 1) / count) * 0.5, `Rendering frame ${n + 1} / ${count}`);
    }
    const onProg = ({ progress }) => { if (progress >= 0 && progress <= 1) onProgress(0.5 + progress * 0.48, `Encoding ${Math.round(progress * 100)}%`); };
    ff.on('progress', onProg);
    onProgress(0.5, format === 'prores' ? 'Encoding ProRes 4444…' : 'Encoding QuickTime Animation…');
    const code = await ff.exec(['-framerate', rate, '-i', 'f_%06d.png', ...CODECS[format],
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', 'out.mov']);
    ff.off('progress', onProg);
    if (code !== 0) throw new Error(`Encoder failed (code ${code}): ${tail.slice(-4).join(' | ')}`);
    const data = await ff.readFile('out.mov');
    await ff.deleteFile('out.mov');
    return new Blob([data], { type: 'video/quicktime' });
  } finally {
    for (const name of names) { try { await ff.deleteFile(name); } catch {} }
  }
}
