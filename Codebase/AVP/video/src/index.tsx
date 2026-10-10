import React, { type CSSProperties } from 'react';
import { AbsoluteFill, Audio, Composition, Easing, Img, OffthreadVideo, Sequence, interpolate, registerRoot, spring, staticFile, useCurrentFrame } from 'remotion';

const FPS = 30;
export const DURATION = 116 * FPS;
const C = { bg: '#070b10', ink: '#f1f5fa', muted: '#94a6ba', cyan: '#19d8e5', mint: '#b3ff53', line: '#213743' };
const sans = 'Arial, Helvetica, sans-serif';
const mono = 'SFMono-Regular, Menlo, Consolas, monospace';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const ease = (f: number, start = 0, length = 25) => interpolate(f, [start, start + length], [0, 1], { ...clamp, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
const appear = (f: number, delay = 0): CSSProperties => ({ opacity: ease(f, delay), transform: `translateY(${(1 - ease(f, delay)) * 28}px)` });

// These excerpts are verbatim from the existing, analyzer-verified Strategy fixture.
const code = [
  'class Compressor {',
  'public:',
  '    virtual ~Compressor() = default;',
  '    virtual std::string compress(const std::string& data) = 0;',
  '};',
  '',
  'class ZipCompressor : public Compressor {',
  'public:',
  '    std::string compress(const std::string& data) override {',
  '        return "ZIP(" + data + ")";',
  '    }',
  '};',
  '',
  'class Archiver {',
  'public:',
  '    void setCompressor(std::unique_ptr<Compressor> c) { compressor = std::move(c); }',
  '    std::string archive(const std::string& payload) {',
  '        if (!compressor) return payload;',
  '        return compressor->compress(payload);',
  '    }',
  'private:',
  '    std::unique_ptr<Compressor> compressor;',
  '};',
];

function Backdrop() {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${65 + Math.sin(f / 180) * 6}% 24%, #10333c88, transparent 62%), radial-gradient(ellipse at 15% 95%, #17263066, transparent 52%)` }} />
    <AbsoluteFill style={{ opacity: 0.17, backgroundImage: 'linear-gradient(#42607333 1px, transparent 1px), linear-gradient(90deg, #42607333 1px, transparent 1px)', backgroundSize: '96px 96px', maskImage: 'linear-gradient(transparent, black 80%)' }} />
    <div style={{ position: 'absolute', left: 100, right: 100, bottom: 63, height: 1, background: C.line }} />
    <div style={{ position: 'absolute', left: 100, bottom: 26, fontSize: 16, letterSpacing: 4, color: C.muted }}>CODINEO</div>
    <div style={{ position: 'absolute', right: 100, bottom: 26, fontFamily: mono, fontSize: 15, color: '#55717d' }}>C++ / DESIGN PATTERNS</div>
  </AbsoluteFill>;
}

function Chapter({ number, children }: { number: string; children: React.ReactNode }) {
  const f = useCurrentFrame();
  return <div style={{ position: 'absolute', top: 67, left: 100, fontSize: 18, fontWeight: 600, letterSpacing: 3.8, textTransform: 'uppercase', color: C.cyan, ...appear(f) }}>
    <span style={{ color: C.muted, marginRight: 28 }}>{number}</span>{children}
  </div>;
}

function Headline({ children, size = 80, top = 118 }: { children: React.ReactNode; size?: number; top?: number }) {
  const f = useCurrentFrame();
  return <div style={{ position: 'absolute', left: 100, top, right: 90, fontSize: size, fontWeight: 700, letterSpacing: -3.5, lineHeight: 1.06, ...appear(f, 4) }}>{children}</div>;
}

function CodePanel({ subdued = false, evidence = false }: { subdued?: boolean; evidence?: boolean }) {
  const f = useCurrentFrame();
  return <div style={{ fontFamily: mono, fontSize: 22, lineHeight: 1.65, whiteSpace: 'pre', opacity: subdued ? 0.4 : 1 }}>
    {code.map((line, i) => <div key={i} style={{ color: evidence && [0, 6, 18, 21].includes(i) ? C.mint : i % 6 === 0 ? C.cyan : '#a0b5c9', opacity: ease(f, i * 1.3, 16), background: evidence && [0, 6, 18, 21].includes(i) ? '#b3ff530e' : undefined }}>
      <span style={{ display: 'inline-block', width: 57, color: '#38515f' }}>{'·'}</span>{line}
    </div>)}
  </div>;
}

function Hook() {
  const f = useCurrentFrame();
  const second = f >= 110;
  return <AbsoluteFill>
    <div style={{ position: 'absolute', left: 690, top: -30, transform: `perspective(1600px) rotateY(-12deg) translateY(${-f * 0.12}px)`, opacity: 0.6 }}><CodePanel subdued /></div>
    <AbsoluteFill style={{ background: 'linear-gradient(90deg, #070b10 18%, #070b10dd 49%, transparent)' }} />
    <Chapter number="00">The gap</Chapter>
    <div style={{ position: 'absolute', left: 100, top: 315, width: 1500, fontWeight: 700, letterSpacing: -5, fontSize: second ? 110 : 128, lineHeight: 1.06, ...appear(f, second ? 110 : 12) }}>
      {second ? <>BUT CAN YOU FIND IT<br /><span style={{ color: C.cyan }}>IN THE CODE?</span></> : <>YOU KNOW<br />THE PATTERN.</>}
    </div>
    <div style={{ position: 'absolute', left: 106, top: 710, width: 80 + ease(f, 20, 180) * 570, height: 3, background: `linear-gradient(90deg, ${C.cyan}, transparent)` }} />
  </AbsoluteFill>;
}

function Theory() {
  const f = useCurrentFrame();
  return <AbsoluteFill>
    <Chapter number="01">From the concept to the implementation</Chapter>
    <Headline>Knowing the idea is the beginning.</Headline>
    <div style={{ position: 'absolute', left: 100, top: 290, width: 655, height: 580, borderRadius: 25, border: `1px solid ${C.line}`, background: '#0c1820', padding: 42, ...appear(f, 10) }}>
      <div style={{ fontFamily: mono, color: C.cyan, letterSpacing: 4, fontSize: 18 }}>THEORY / STRATEGY</div>
      <div style={{ fontSize: 42, marginTop: 43, letterSpacing: -1.2 }}>One interface.<br />Interchangeable algorithms.</div>
      <div style={{ margin: '57px auto 0', width: 330, border: `1px solid ${C.cyan}`, padding: '22px 10px', textAlign: 'center', borderRadius: 12, fontFamily: mono, fontSize: 26 }}>Strategy</div>
      <div style={{ height: 44, width: 1, background: C.cyan, margin: '0 auto' }} />
      <div style={{ display: 'flex', gap: 18 }}>
        {['Algorithm A', 'Algorithm B'].map((text) => <div key={text} style={{ flex: 1, textAlign: 'center', padding: 23, borderRadius: 12, background: '#16303b', fontSize: 25 }}>{text}</div>)}
      </div>
    </div>
    <div style={{ position: 'absolute', top: 290, left: 800, width: 1020, height: 580, overflow: 'hidden', padding: 38, border: `1px solid ${C.line}`, borderRadius: 25, background: '#0a1018', ...appear(f, 24) }}>
      <div style={{ fontFamily: mono, color: C.muted, letterSpacing: 4, fontSize: 18, marginBottom: 24 }}>IMPLEMENTATION / C++</div>
      <div style={{ height: 460, overflow: 'hidden' }}><div style={{ transform: `translateY(${-Math.max(0, f - 100) * 0.8}px)` }}><CodePanel /></div></div>
    </div>
    <div style={{ position: 'absolute', top: 914, left: 104, fontSize: 31, color: C.muted, ...appear(f, 115) }}>Recognize it through <span style={{ color: C.ink }}>classes, methods, and relationships.</span></div>
  </AbsoluteFill>;
}

function Brand({ close = false }: { close?: boolean }) {
  const f = useCurrentFrame();
  const scale = interpolate(spring({ frame: f, fps: FPS, config: { damping: 24, stiffness: 60 } }), [0, 1], [0.92, 1]);
  return <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
    {close && <div style={{ position: 'absolute', top: 50, left: 570, opacity: 0.08, transform: 'rotate(-8deg)' }}><CodePanel evidence /></div>}
    <div style={{ width: 580, height: 580, position: 'absolute', borderRadius: '50%', background: '#18d8e511', filter: 'blur(80px)' }} />
    <div style={{ textAlign: 'center', transform: `scale(${scale})`, ...{ opacity: ease(f, 0, 22) } }}>
      {!close && <div style={{ color: C.cyan, letterSpacing: 7, fontSize: 21, marginBottom: 38 }}>INTRODUCING</div>}
      <div style={{ fontWeight: 800, fontSize: 190, letterSpacing: -8, lineHeight: 1 }}><span style={{ color: C.ink }}>CODI</span><span style={{ color: C.cyan }}>NEO</span><span style={{ color: C.mint }}>.</span></div>
      {close && <div style={{ fontSize: 43, letterSpacing: -0.8, lineHeight: 1.22, marginTop: 47, ...appear(f, 10) }}>FROM DESIGN-PATTERN THEORY<br />TO ACTUAL C++ IMPLEMENTATION.</div>}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: close ? 52 : 65 }}>
        {['LEARN.', 'ANALYZE.', 'UNDERSTAND.', 'DOCUMENT.'].map((text, i) => <span key={text} style={{ color: i === 0 ? C.mint : C.muted, fontSize: 25, letterSpacing: 2, ...appear(f, 18 + i * 12) }}>{text}</span>)}
      </div>
    </div>
  </AbsoluteFill>;
}

type Crop = [number, number, number, number];
function Footage({ clip, crop, width = 1720, height = 690, left = 100, top = 277 }: { clip: string; crop: Crop; width?: number; height?: number; left?: number; top?: number }) {
  const f = useCurrentFrame();
  const camera = interpolate(f, [0, 240], [1, 1.025], clamp);
  const scale = Math.max(width / crop[2], height / crop[3]);
  // Lossless screenshots are captured from the same real UI at the end of each
  // take. Use them for steady holds; preserve the recording for interactions.
  const steadyShot = ['02_', '04_', '05_', '09_', '11_', '12_'].some((prefix) => clip.startsWith(prefix));
  const mediaStyle: CSSProperties = { position: 'absolute', width: 1920 * scale, height: 1080 * scale, maxWidth: 'none', left: -crop[0] * scale, top: -crop[1] * scale };
  return <div style={{ position: 'absolute', left, top, width, height, borderRadius: 21, overflow: 'hidden', border: '1px solid #2a4653', boxShadow: '0 30px 100px #0009', background: '#0b1119', ...appear(f, 7) }}>
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${camera})` }}>
      {f >= (steadyShot ? 15 : 90)
        ? <Img src={staticFile(`stills/${clip}.png`)} style={mediaStyle} />
        : <OffthreadVideo muted src={staticFile(`clips/${clip}.mp4`)} style={mediaStyle} />}
    </div>
  </div>;
}

function ProductShot({ number, chapter, title, clip, crop, note, frameWidth = 1720 }: { number: string; chapter: string; title: React.ReactNode; clip: string; crop: Crop; note?: string; frameWidth?: number }) {
  return <AbsoluteFill><Chapter number={number}>{chapter}</Chapter><Headline size={74}>{title}</Headline><Footage clip={clip} crop={crop} width={frameWidth} left={(1920 - frameWidth) / 2} />
    {note && <div style={{ position: 'absolute', right: 120, top: 238, fontSize: 16, color: C.muted, fontFamily: mono }}>{note}</div>}
  </AbsoluteFill>;
}

function Node({ x, y, w = 500, title, subtitle, delay, mint = false }: { x: number; y: number; w?: number; title: string; subtitle: string; delay: number; mint?: boolean }) {
  const f = useCurrentFrame();
  const color = mint ? C.mint : C.cyan;
  return <div style={{ position: 'absolute', left: x, top: y, width: w, height: 128, padding: '24px 28px', border: `1px solid ${color}88`, background: '#0b1b24', borderRadius: 17, boxShadow: `0 0 50px ${color}08`, ...appear(f, delay) }}>
    <div style={{ color, fontSize: 16, letterSpacing: 2, marginBottom: 12 }}>{subtitle}</div>
    <div style={{ fontFamily: mono, fontSize: 30 }}>{title}</div>
  </div>;
}

function Graph() {
  const f = useCurrentFrame();
  const paths = [
    { d: 'M 720 411 L 1130 411', delay: 75 },
    { d: 'M 410 700 L 410 583 L 1320 583 L 1320 475', delay: 135 },
    { d: 'M 1000 700 L 1000 627 L 1400 627 L 1400 475', delay: 160 },
  ];
  return <AbsoluteFill>
    <Chapter number="05">Graph Memory Copy / conceptual view</Chapter>
    <Headline size={77}>Follow the structure.</Headline>
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
      <defs><marker id="arrow" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M1 1 L11 6 L1 11" fill="none" stroke={C.cyan} strokeWidth="1.5" /></marker></defs>
      {paths.map((p, i) => <path key={i} d={p.d} pathLength={1} stroke={C.cyan} strokeWidth={2} fill="none" strokeDasharray={1} strokeDashoffset={1 - ease(f, p.delay, 40)} opacity={ease(f, p.delay, 10)} markerEnd="url(#arrow)" />)}
    </svg>
    <Node x={160} y={345} w={560} title="Archiver" subtitle="CONTEXT / STORED REFERENCE" delay={15} />
    <Node x={1130} y={345} w={610} title="Compressor" subtitle="STRATEGY INTERFACE" delay={40} mint />
    <Node x={160} y={700} title="ZipCompressor" subtitle="CONCRETE STRATEGY" delay={115} />
    <Node x={750} y={700} title="GzipCompressor" subtitle="CONCRETE STRATEGY" delay={140} />
    <Node x={1340} y={700} w={400} title="Strategy" subtitle="SUPPORTED EVIDENCE" delay={310} mint />
    <div style={{ position: 'absolute', left: 785, top: 350, fontSize: 18, color: C.muted, ...appear(f, 90) }}>holds & delegates</div>
    <div style={{ position: 'absolute', left: 480, top: 542, fontSize: 18, color: C.muted, ...appear(f, 150) }}>inherits the shared interface</div>
    <div style={{ position: 'absolute', left: 1138, top: 492, fontFamily: mono, fontSize: 24, color: C.mint, ...appear(f, 60) }}>compress(data)</div>
    <div style={{ position: 'absolute', left: 150, right: 150, top: 900, display: 'flex', alignItems: 'center', gap: 26 }}>
      {['SOURCE', 'STRUCTURE', 'RELATIONSHIPS', 'EVIDENCE'].map((item, i) => <React.Fragment key={item}>
        {i > 0 && <span style={{ color: '#486272', opacity: ease(f, 190 + i * 35) }}>→</span>}
        <div style={{ flex: 1, fontSize: 21, letterSpacing: 3, color: i === 3 ? C.mint : C.muted, ...appear(f, 185 + i * 35) }}>{item}</div>
      </React.Fragment>)}
    </div>
  </AbsoluteFill>;
}

export type AVPProps = { voiceover?: string; music?: boolean };
export function AVP({ voiceover, music = true }: AVPProps) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ color: C.ink, fontFamily: sans, background: C.bg }}>
    <Backdrop />
    <Sequence from={0} durationInFrames={240}><Hook /></Sequence>
    <Sequence from={240} durationInFrames={390}><Theory /></Sequence>
    <Sequence from={630} durationInFrames={240}><Brand /></Sequence>
    <Sequence from={870} durationInFrames={240}><ProductShot number="02" chapter="Project-guided learning" title={<>Start with <span style={{ color: C.cyan }}>what matters.</span></>} clip="01_pm_project_spec" crop={[625, 455, 950, 390]} note="Community Project Prioritization System" /></Sequence>
    <Sequence from={1110} durationInFrames={240}><ProductShot number="02" chapter="Relevant concepts" title={<>Your project. <span style={{ color: C.mint }}>A focused direction.</span></>} clip="02_pm_strategy_recommendation" crop={[680, 368, 825, 330]} /></Sequence>
    <Sequence from={1350} durationInFrames={90}><ProductShot number="03" chapter="Targeted learning / pre-test" title="Find your starting point." clip="03_intern_pretest" crop={[550, 402, 830, 335]} /></Sequence>
    <Sequence from={1440} durationInFrames={90}><ProductShot number="03" chapter="Targeted learning / next step" title={<>Focus on <span style={{ color: C.mint }}>Strategy.</span></>} clip="04_strategy_recommended" crop={[844, 258, 470, 240]} frameWidth={1350} /></Sequence>
    <Sequence from={1530} durationInFrames={165}><ProductShot number="03" chapter="Learn / Strategy" title="Make the concept click." clip="05_strategy_module" crop={[552, 92, 1090, 440]} /></Sequence>
    <Sequence from={1695} durationInFrames={105}><ProductShot number="03" chapter="Apply your understanding" title="Learn. Reflect. Apply." clip="06_strategy_assessment" crop={[610, 210, 980, 395]} /></Sequence>
    <Sequence from={1800} durationInFrames={120}><ProductShot number="04" chapter="Studio / real C++ source" title="Now, understand the implementation." clip="07_studio_source_upload" crop={[250, 250, 1420, 570]} note="Verified C++ Strategy example · compression" /></Sequence>
    <Sequence from={1920} durationInFrames={120}><ProductShot number="04" chapter="Analyze" title={<>From source code <span style={{ color: C.cyan }}>to structure.</span></>} clip="08_studio_analyze" crop={[250, 250, 1420, 570]} /></Sequence>
    <Sequence from={2040} durationInFrames={450}><Graph /></Sequence>
    <Sequence from={2490} durationInFrames={240}><ProductShot number="06" chapter="Supported design-pattern evidence" title={<>Don't just detect it. <span style={{ color: C.mint }}>Understand why.</span></>} clip="09_strategy_result_overview" crop={[255, 570, 1040, 420]} /></Sequence>
    <Sequence from={2730} durationInFrames={240}><ProductShot number="06" chapter="Traceable source evidence" title={<>Follow the <span style={{ color: C.cyan }}>delegation.</span></>} clip="10_strategy_evidence_detail" crop={[250, 610, 1050, 425]} /></Sequence>
    <Sequence from={2970} durationInFrames={180}><ProductShot number="07" chapter="Document" title={<>From code <span style={{ color: C.cyan }}>to context.</span></>} clip="11_generated_documentation" crop={[255, 432, 1040, 420]} /></Sequence>
    <Sequence from={3150} durationInFrames={150}><ProductShot number="07" chapter="Keep the explanation" title="Export your documentation." clip="12_export_controls" crop={[255, 112, 1040, 420]} note="PDF · Word · Markdown" /></Sequence>
    <Sequence from={3300} durationInFrames={180}><Brand close /></Sequence>
    {music && <Audio src={staticFile('score.wav')} volume={voiceover ? 0.36 : 0.7} />}
    {voiceover && <Audio src={staticFile(voiceover)} volume={1} />}
    <AbsoluteFill style={{ pointerEvents: 'none', background: C.bg, opacity: interpolate(f, [0, 12, DURATION - 14, DURATION - 1], [1, 0, 0, 1], clamp) }} />
  </AbsoluteFill>;
}

registerRoot(() => <Composition id="CodiNeoAVP" component={AVP} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={{ music: true }} />);
