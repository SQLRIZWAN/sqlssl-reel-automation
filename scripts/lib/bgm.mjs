// bgm.mjs — STEP 5: Dark Cyberpunk Electronic beat (80-100 BPM) — asset ya synth
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT, info, run } from './util.mjs';

export async function makeBgm(settings, duration) {
  const outFile = path.join(OUT, 'bgm.wav');
  const fade = settings.bgm.fade_in;
  const assetCandidates = [
    path.join(ROOT, 'assets', 'bgm.mp3'),
    path.join(ROOT, 'assets', 'bgm.wav'),
    path.join(ROOT, 'assets', 'bgm.m4a'),
  ];
  const asset = assetCandidates.find((p) => fs.existsSync(p));

  if (asset && settings.bgm.provider_priority.includes('asset')) {
    info(`  BGM asset use ho raha hai: ${path.basename(asset)}`);
    run('ffmpeg', [
      '-y', '-stream_loop', '-1', '-i', asset, '-t', String(duration),
      '-af', `afade=t=in:ss=0:d=${fade},afade=t=out:st=${Math.max(0, duration - fade)}:d=${fade}`,
      '-ar', '44100', '-ac', '1', outFile,
    ]);
    return outFile;
  }

  info('  BGM synth: dark cyberpunk electronic (90 BPM)');
  const d = duration;
  const beat = 60 / settings.bgm.bpm; // 90 BPM
  // Low sub bass pulse + dark pad + soft rhythmic ticks (hi-hat feel)
  const filter = [
    // sub bass: 55Hz sine with slow pulse
    `sine=f=55:d=${d}:sample_rate=44100,afade=t=in:ss=0:d=1,volume=0.35[bass]`,
    // dark pad: 110 + 164.81 Hz (A2+E3) slight detune
    `sine=f=110:d=${d}:sample_rate=44100,volume=0.16[p1]`,
    `sine=f=164.81:d=${d}:sample_rate=44100,volume=0.11[p2]`,
    `sine=f=82.41:d=${d}:sample_rate=44100,volume=0.12[p3]`,
    // rhythmic soft ticks every beat (subtle hi-hat)
    `aevalsrc='0.09*exp(-25*mod(t,${beat}))*(random(0)*0.6+0.4)*gt(mod(t,${beat}),0)':s=44100:d=${d}[hats]`,
    // airy noise texture
    `anoisesrc=d=${d}:r=44100:c=pink,volume=0.035,lowpass=f=900[air]`,
    `[bass][p1][p2][p3][hats][air]amix=inputs=6:normalize=0,atempo=1.0,afade=t=in:ss=0:d=${fade},afade=t=out:st=${Math.max(0, d - fade)}:d=${fade},acompressor=threshold=0.05:ratio=3[out]`,
  ].join(';');

  run('ffmpeg', [
    '-y',
    '-filter_complex', filter,
    '-map', '[out]',
    '-t', String(d),
    outFile,
  ]);
  return outFile;
}
