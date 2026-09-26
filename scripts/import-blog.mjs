// Blogs Raza media: raw films and photos → web-ready copies.
//
//   npm run import:blog
//
// Reads the list in src/blog/reels.js and the raw files in its SOURCE folder,
// and writes to public/media/blog/:
//   <slug>.mp4      the film: ≤720 px wide, H.264 + AAC, starts streaming at once
//   <slug>-p.mp4    a 4-second silent loop for hover / in-view previews
//   <slug>.webp     the poster still
//   photo-NN.webp   each photo (and -sm for the wall)
// plus src/blog/media.json (sizes, durations) for the page. Files that are
// already up to date are skipped, so re-running after adding one film is quick.
//
// Needs ffmpeg: on PATH, or FFMPEG=/path/to/ffmpeg, or `npm i -D ffmpeg-static`.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { SOURCE, REELS, PHOTOS } from '../src/blog/reels.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const src = path.join(root, SOURCE);
const out = path.join(root, 'public/media/blog');
mkdirSync(out, { recursive: true });

async function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    return (await import('ffmpeg-static')).default;
  } catch {
    return 'ffmpeg';
  }
}
const ffmpeg = await findFfmpeg();
// maxBuffer: a poster frame comes back as a full-size PNG on stdout
const run = (args) => execFileSync(ffmpeg, ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
const fresh = (target, from) => existsSync(target) && statSync(target).mtimeMs >= statSync(from).mtimeMs;
const duration = (file) => {
  // ffmpeg prints "Duration: 00:00:13.52" for any input
  let text = '';
  try { execFileSync(ffmpeg, ['-i', file], { stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { text = String(e.stderr); }
  const m = text.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
};

const media = { reels: {}, photos: [] };
const keep = new Set();
let bytes = 0;
for (const r of REELS) {
  const file = path.join(src, r.file);
  if (!existsSync(file)) {
    console.log(`  ! missing ${r.file} (${r.slug}) — skipped`);
    continue;
  }
  const films = { video: `${r.slug}.mp4`, preview: `${r.slug}-p.mp4`, poster: `${r.slug}.webp` };
  Object.values(films).forEach((f) => keep.add(f));
  const at = (f) => path.join(out, f);
  const dur = duration(file);
  if (!fresh(at(films.video), file)) {
    run(['-i', file, '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-vf', "scale='min(720,iw)':-2", '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', at(films.video)]);
  }
  if (!fresh(at(films.preview), file)) {
    const start = Math.min(r.preview ?? 1, Math.max(0, dur - 4.2));
    run(['-ss', String(start), '-t', '4', '-i', file, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p',
      '-vf', 'scale=360:-2,fps=24', '-movflags', '+faststart', at(films.preview)]);
  }
  if (!fresh(at(films.poster), file)) {
    const png = run(['-ss', String(Math.min(r.poster ?? 1, Math.max(0, dur - 0.2))), '-i', file, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-']);
    await sharp(png).resize({ width: 540 }).webp({ quality: 72 }).toFile(at(films.poster));
  }
  const { width, height } = await sharp(at(films.poster)).metadata();
  const size = statSync(at(films.video)).size;
  bytes += size + statSync(at(films.preview)).size + statSync(at(films.poster)).size;
  media.reels[r.slug] = { ...films, duration: Math.round(dur * 10) / 10, ratio: Math.round((width / height) * 1000) / 1000, mb: Math.round((size / 1e6) * 10) / 10 };
  process.stdout.write(`\r  ${Object.keys(media.reels).length}/${REELS.length} ${r.slug}`.padEnd(70));
}
console.log('');

for (const [i, name] of PHOTOS.entries()) {
  const file = path.join(src, name);
  if (!existsSync(file)) {
    console.log(`  ! missing ${name} — skipped`);
    continue;
  }
  const n = String(i + 1).padStart(2, '0');
  const big = `photo-${n}.webp`;
  const small = `photo-${n}-sm.webp`;
  keep.add(big);
  keep.add(small);
  if (!fresh(path.join(out, big), file)) await sharp(file).rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(out, big));
  if (!fresh(path.join(out, small), file)) await sharp(file).rotate().resize({ width: 480 }).webp({ quality: 70 }).toFile(path.join(out, small));
  const { width, height } = await sharp(path.join(out, big)).metadata();
  bytes += statSync(path.join(out, big)).size + statSync(path.join(out, small)).size;
  media.photos.push({ src: big, sm: small, ratio: Math.round((width / height) * 1000) / 1000 });
}

// drop outputs no longer in the list
for (const f of readdirSync(out)) if (!keep.has(f)) rmSync(path.join(out, f));

writeFileSync(path.join(root, 'src/blog/media.json'), `${JSON.stringify(media, null, 2)}\n`);
console.log(`public/media/blog: ${Object.keys(media.reels).length} films, ${media.photos.length} photos, ${(bytes / 1e6).toFixed(1)} MB`);
