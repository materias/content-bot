import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

// ffmpeg-static ships CJS-only types that don't resolve cleanly under
// moduleResolution: NodeNext + ESM — require() sidesteps the interop issue.
const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static') as string | null;

const execFileAsync = promisify(execFile);

// Frame 0 is sometimes a black transition/loading frame — 1s in is a safer
// representative still without needing to inspect the video first.
const FRAME_TIMESTAMP_SECONDS = '1';

export async function extractRepresentativeFrame(videoBuffer: Buffer): Promise<Buffer> {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static did not resolve a binary path for this platform');
  }

  const dir = await mkdtemp(join(tmpdir(), 'content-bot-video-'));
  const inputPath = join(dir, 'input.mp4');
  const outputPath = join(dir, 'frame.jpg');

  try {
    await writeFile(inputPath, videoBuffer);
    await execFileAsync(ffmpegPath, [
      '-y',
      '-ss', FRAME_TIMESTAMP_SECONDS,
      '-i', inputPath,
      '-frames:v', '1',
      '-q:v', '2',
      outputPath,
    ]);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
