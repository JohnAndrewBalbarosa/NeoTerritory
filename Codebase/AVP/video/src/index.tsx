import React, { type CSSProperties } from 'react';
import { AbsoluteFill, Audio, Composition, Easing, Img, OffthreadVideo, Sequence, interpolate, registerRoot, spring, staticFile, useCurrentFrame } from 'remotion';

const FPS = 30;
export const DURATION = 116 * FPS;
const C = { bg: 'var(--bg)', ink: 'var(--ink)', muted: 'var(--muted)', cyan: 'var(--cyan)', mint: 'var(--mint)', line: 'var(--line)' };
const SCENE_STARTS = [0, 240, 630, 870, 1110, 1350, 1440, 1530, 1695, 1800, 1920, 2040, 2490, 2730, 2970, 3150, 3300];
const sceneIndex = (frame: number) => SCENE_STARTS.reduce((index, start, i) => frame >= start ? i : index, 0);
const themeStyle = (light: boolean): CSSProperties => ({
  '--bg': light ? '#f7f9f8' : '#070b0d',
  '--ink': light ? '#102721' : '#f1f7f4',
  '--muted': light ? '#506b62' : '#a1b6ae',
  '--cyan': light ? '#00786d' : '#37dfcd',
  '--mint': light ? '#26713e' : '#b7f766',
  '--line': light ? '#bdd2c7' : '#29443b',
  '--surface': light ? '#ffffffeb' : '#0d1b19ed',
  '--soft': light ? '#e3eee7' : '#19382d',
  '--code': light ? '#375e51' : '#afc8c0',
  '--shadow': light ? '#345a3520' : '#0008',
} as CSSProperties);
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

// Scene-level contrast alternates at every cut, not just at chapter changes.
function Backdrop() {
  const f = useCurrentFrame();
  const index = sceneIndex(f);
  const light = index % 2 === 0;
  const local = f - SCENE_STARTS[index];
  const x = Math.sin(f / 190) * 95;
  const y = Math.cos(f / 260) * 55;
  return <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', inset: -200, background: light
      ? 'radial-gradient(ellipse at 80% 75%, #c8ebd6aa, transparent 44%), radial-gradient(ellipse at 12% 52%, #dcefe377, transparent 40%)'
      : 'radial-gradient(ellipse at 80% 72%, #36684655, transparent 44%), radial-gradient(ellipse at 10% 50%, #0d776a44, transparent 42%)', transform: `translate(${x}px, ${y}px)` }} />
    <svg width="2200" height="1250" viewBox="0 0 2200 1250" style={{ position: 'absolute', left: -130, top: -30, opacity: light ? 0.52 : 0.4, transform: `translate(${-x * 0.5}px, ${y * 0.7}px) rotate(${Math.sin(f / 240) * 6}deg)` }}>
      <defs><linearGradient id="ribbon" x1="0" x2="1" y1="0" y2="1"><stop stopColor={light ? '#eaf6ed' : '#0a2521'} stopOpacity="0" /><stop offset="0.55" stopColor={light ? '#badfc9' : '#175b45'} stopOpacity="0.6" /><stop offset="1" stopColor={light ? '#72bc94' : '#8adc76'} stopOpacity="0.8" /></linearGradient></defs>
      <path d="M-300 1080 C280 1530 790 300 1340 680 S2100 1260 2500 380" fill="none" stroke="url(#ribbon)" strokeWidth="190" />
      <path d="M-300 982 C280 1432 790 202 1340 582 S2100 1162 2500 282" fill="none" stroke={light ? '#8ac9a6' : '#9bdca4'} strokeOpacity="0.22" strokeWidth="2" />
    </svg>
    <div style={{ position: 'absolute', right: -220, top: 370, width: 850, height: 850, border: `1px solid ${light ? '#aecbb94d' : '#4d876642'}`, borderRadius: '50%', transform: `scale(${0.92 + ease(local, 0, 150) * 0.16}) translateY(${y * 0.3}px)` }} />
    <div style={{ position: 'absolute', left: 100, right: 100, bottom: 63, height: 1, background: C.line, opacity: 0.6 }} />
    <div style={{ position: 'absolute', left: 100, bottom: 26, fontSize: 16, letterSpacing: 4, color: C.muted }}>CODINEO</div>
    <div style={{ position: 'absolute', right: 100, bottom: 26, fontFamily: mono, fontSize: 15, color: C.muted }}>C++ / DESIGN PATTERNS</div>
  </AbsoluteFill>;
}

// Preserve nested accent spans while revealing each word through its own mask.
function KineticText({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const f = useCurrentFrame();
  let index = 0;
  const reveal = (node: React.ReactNode): React.ReactNode => React.Children.map(node, (child) => {
    if (typeof child === 'string') return child.split(/(\s+)/).map((word, i) => {
      if (!word.trim()) return word;
      const n = index++;
      const t = ease(f, delay + n * 3, 29);
      return <span key={`${n}-${i}`} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', paddingBottom: '0.08em', marginBottom: '-0.08em' }}><span style={{ display: 'inline-block', opacity: t, transform: `translate(${(1 - t) * 24}px, ${(1 - t) * 135}%) rotate(${(1 - t) * 7}deg) scale(${0.82 + t * 0.18})` }}>{word}</span></span>;
    });
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.props.children) return React.cloneElement(child, {}, reveal(child.props.children));
    return child;
  });
  return <>{reveal(children)}</>;
}

function ShapeWipe() {
  const f = useCurrentFrame();
  const cut = SCENE_STARTS.slice(1).find((c) => Math.abs(f - c) < 12);
  if (cut === undefined) return null;
  const index = SCENE_STARTS.indexOf(cut);
  const t = (f - cut + 12) / 24;
  const x = interpolate(t, [0, 0.5, 1], [-2800, -230, 2250], { easing: Easing.bezier(0.45, 0, 0.55, 1) });
  const round = index % 2 === 0;
  return <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', width: 2520, height: 2520, borderRadius: round ? '50%' : 160, top: -720, left: x, background: index % 2 === 0 ? '#d5efde' : '#0c382a', transform: round ? undefined : 'rotate(-15deg)' }} />
    <div style={{ position: 'absolute', width: 100, height: 1500, top: -200, left: x + 2510, background: '#8cdb82', transform: 'rotate(-15deg)', opacity: round ? 0 : 0.7 }} />
  </AbsoluteFill>;
}

function Chapter({ number, children }: { number: string; children: React.ReactNode }) {
  const f = useCurrentFrame();
  return <div style={{ position: 'absolute', top: 57, left: 100, display: 'flex', alignItems: 'center', gap: 20, fontSize: 17, fontWeight: 600, letterSpacing: 3.3, textTransform: 'uppercase', color: C.cyan }}>
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 49, height: 37, borderRadius: 30, background: 'var(--soft)', color: C.ink, letterSpacing: 0, transform: `scale(${ease(f, 0, 22)})` }}>{number}</span>
    <span style={{ overflow: 'hidden', clipPath: `inset(0 ${(1 - ease(f, 5, 35)) * 100}% 0 0)` }}>{children}</span>
  </div>;
}

function Headline({ children, size = 80, top = 118, centered = false }: { children: React.ReactNode; size?: number; top?: number; centered?: boolean }) {
  return <div style={{ position: 'absolute', left: 100, top, right: 100, textAlign: centered ? 'center' : 'left', fontSize: size, fontWeight: 700, letterSpacing: -3.5, lineHeight: 1.06, }}><KineticText delay={4}>{children}</KineticText></div>;
}

function CodePanel({ subdued = false, evidence = false }: { subdued?: boolean; evidence?: boolean }) {
  const f = useCurrentFrame();
  return <div style={{ fontFamily: mono, fontSize: 22, lineHeight: 1.65, whiteSpace: 'pre', opacity: subdued ? 0.4 : 1 }}>
    {code.map((line, i) => <div key={i} style={{ color: evidence && [0, 6, 18, 21].includes(i) ? C.mint : i % 6 === 0 ? C.cyan : 'var(--code)', opacity: ease(f, i * 1.3, 16), background: evidence && [0, 6, 18, 21].includes(i) ? 'var(--soft)' : undefined }}>
      <span style={{ display: 'inline-block', width: 57, color: C.muted }}>{'·'}</span>{line}
    </div>)}
  </div>;
}

function Hook() {
  const f = useCurrentFrame();
  const second = f >= 110;
  return <AbsoluteFill>
    <div style={{ position: 'absolute', left: 690, top: -30, transform: `perspective(1600px) rotateY(-12deg) translateY(${-f * 0.12}px)`, opacity: 0.6 }}><CodePanel subdued /></div>
    <AbsoluteFill style={{ background: 'linear-gradient(90deg, var(--bg) 5%, color-mix(in srgb, var(--bg) 87%, transparent) 48%, transparent)' }} />
    <Chapter number="00">The gap</Chapter>
    <div style={{ position: 'absolute', left: 100, right: 100, top: 315, textAlign: 'center', fontWeight: 700, letterSpacing: -5, fontSize: second ? 110 : 128, lineHeight: 1.06, ...appear(f, second ? 110 : 12) }}>
      <KineticText key={String(second)} delay={second ? 110 : 12}>{second ? <>BUT CAN YOU FIND IT<br /><span style={{ color: C.cyan }}>IN THE CODE?</span></> : <>YOU KNOW<br />THE PATTERN.</>}</KineticText>
    </div>
    <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 710, width: 80 + ease(f, 20, 180) * 570, height: 3, background: `linear-gradient(90deg, transparent, ${C.cyan}, transparent)` }} />
  </AbsoluteFill>;
}

function Theory() {
  const f = useCurrentFrame();
  return <AbsoluteFill>
    <Chapter number="01">From the concept to the implementation</Chapter>
    <Headline centered>Knowing the idea is the beginning.</Headline>
    <div style={{ position: 'absolute', left: 100, top: 290, width: 655, height: 580, borderRadius: 25, border: `1px solid ${C.line}`, background: 'var(--surface)', boxShadow: '0 24px 80px var(--shadow)', padding: 42, ...appear(f, 10) }}>
      <div style={{ fontFamily: mono, color: C.cyan, letterSpacing: 4, fontSize: 18 }}>THEORY / STRATEGY</div>
      <div style={{ fontSize: 42, marginTop: 43, letterSpacing: -1.2 }}>One interface.<br />Interchangeable algorithms.</div>
      <div style={{ margin: '57px auto 0', width: 330, border: `1px solid ${C.cyan}`, padding: '22px 10px', textAlign: 'center', borderRadius: 12, fontFamily: mono, fontSize: 26 }}>Strategy</div>
      <div style={{ height: 44, width: 1, background: C.cyan, margin: '0 auto' }} />
      <div style={{ display: 'flex', gap: 18 }}>
        {['Algorithm A', 'Algorithm B'].map((text) => <div key={text} style={{ flex: 1, textAlign: 'center', padding: 23, borderRadius: 12, background: 'var(--soft)', fontSize: 25 }}>{text}</div>)}
      </div>
    </div>
    <div style={{ position: 'absolute', top: 290, left: 800, width: 1020, height: 580, overflow: 'hidden', padding: 38, border: `1px solid ${C.line}`, borderRadius: 25, background: 'var(--surface)', boxShadow: '0 24px 80px var(--shadow)', ...appear(f, 24) }}>
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
    <div style={{ width: 580, height: 580, position: 'absolute', borderRadius: '50%', background: 'radial-gradient(circle, #71eab544, #18d8e500 70%)', transform: `scale(${1.6 + Math.sin(f / 65) * 0.15})` }} />
    <div style={{ textAlign: 'center', transform: `scale(${scale})`, ...{ opacity: ease(f, 0, 22) } }}>
      {!close && <div style={{ color: C.cyan, letterSpacing: 7, fontSize: 21, marginBottom: 38 }}>INTRODUCING</div>}
      <div style={{ fontWeight: 800, fontSize: 190, letterSpacing: -8, lineHeight: 1 }}><span style={{ display: 'inline-block', color: C.ink, transform: `translateX(${(1 - ease(f, 0, 35)) * -240}px)` }}>CODI</span><span style={{ display: 'inline-block', color: C.cyan, transform: `translateX(${(1 - ease(f, 0, 35)) * 240}px)` }}>NEO</span><span style={{ display: 'inline-block', color: C.mint, transform: `scale(${ease(f, 25, 20)})` }}>.</span></div>
      {close && <div style={{ fontSize: 43, letterSpacing: -0.8, lineHeight: 1.22, marginTop: 47, ...appear(f, 10) }}>FROM DESIGN-PATTERN THEORY<br />TO ACTUAL C++ IMPLEMENTATION.</div>}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: close ? 52 : 65 }}>
        {['LEARN.', 'ANALYZE.', 'UNDERSTAND.', 'DOCUMENT.'].map((text, i) => <span key={text} style={{ color: i === 0 ? C.mint : C.muted, background: 'var(--surface)', border: `1px solid ${C.line}`, borderRadius: 40, padding: '17px 24px', fontSize: 23, letterSpacing: 2, opacity: ease(f, 18 + i * 12), transform: `translateY(${(1 - ease(f, 18 + i * 12)) * 80}px) rotate(${(1 - ease(f, 18 + i * 12)) * (i % 2 ? 8 : -8)}deg)` }}>{text}</span>)}
      </div>
    </div>
  </AbsoluteFill>;
}

type Crop = [number, number, number, number];
function ScreenMedia({ clip, crop, width, height, still = false }: { clip: string; crop: Crop; width: number; height: number; still?: boolean }) {
  const f = useCurrentFrame();
  const scale = Math.max(width / crop[2], height / crop[3]);
  const steadyShot = ['02_', '04_', '05_', '09_', '11_', '12_'].some((prefix) => clip.startsWith(prefix));
  // Capture coordinates are 1920 × 1080 CSS pixels; the lossless PNGs are 2×.
  const mediaStyle: CSSProperties = { position: 'absolute', width: 1920 * scale, height: 1080 * scale, maxWidth: 'none', left: -crop[0] * scale, top: -crop[1] * scale };
  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0b1119' }}>
    {still || f >= (steadyShot ? 15 : 90)
      ? <Img src={staticFile(`stills/${clip}.png`)} style={mediaStyle} />
      : <OffthreadVideo muted src={staticFile(`clips/${clip}.mp4`)} style={mediaStyle} />}
  </div>;
}

// The mockup is studio-rendered raster artwork, with real captured pixels placed
// in its measured display rectangle. Preserve the hardware aspect ratio.
function Footage({ clip, crop, width = 1180, left = 370, top = 215 }: { clip: string; crop: Crop; width?: number; left?: number; top?: number; laptop?: boolean }) {
  const f = useCurrentFrame();
  const unit = width / 1536;
  const height = width * 1024 / 1536;
  const t = ease(f, 3, 34);
  const direction = Number(clip.slice(0, 2)) % 2 ? 1 : -1;
  const push = 1 + ease(f, 40, 170) * 0.025;
  // Expand the source crop vertically to fill the physical display without
  // stretching the application or cutting away the selected evidence.
  const sourceHeight = crop[2] * 630 / 1090;
  const sourceY = Math.max(0, Math.min(1080 - sourceHeight, crop[1] + (crop[3] - sourceHeight) / 2));
  const displayCrop: Crop = [crop[0], sourceY, crop[2], sourceHeight];
  return <div style={{ position: 'absolute', left, top, width, height, perspective: 2100 }}>
    <div style={{ position: 'absolute', left: '12%', right: '12%', bottom: 25, height: 26, borderRadius: '50%', background: 'radial-gradient(ellipse, #0005, transparent 70%)', opacity: t, transform: `scaleX(${0.7 + t * 0.3})` }} />
    <div style={{ position: 'absolute', inset: 0, opacity: t, transformOrigin: '50% 55%', transform: `translate(${direction * (1 - t) * 250}px, ${(1 - t) * 100 + Math.sin(f / 55) * 4}px) rotateY(${direction * (1 - t) * 28}deg) rotateX(${(1 - t) * 9}deg) rotateZ(${direction * (1 - t) * 7}deg) scale(${(0.72 + t * 0.28) * push})` }}>
      <Img src={staticFile('devices/laptop-studio.png')} style={{ position: 'absolute', inset: 0, width, height }} />
      <div style={{ position: 'absolute', left: 223 * unit, top: 96 * unit, width: 1090 * unit, height: 630 * unit, overflow: 'hidden', background: '#090c10' }}>
        <ScreenMedia clip={clip} crop={displayCrop} width={1090 * unit} height={630 * unit} />
      </div>
    </div>
  </div>;
}

const details: Record<string, { crop: Crop; label: string }> = {
  '02_pm_strategy_recommendation': { crop: [710, 480, 780, 123], label: 'PROJECT → RELEVANT CONCEPT' },
  '09_strategy_result_overview': { crop: [255, 570, 1040, 115], label: 'THE INTERFACE, IN THE SOURCE' },
  '10_strategy_evidence_detail': { crop: [280, 722, 970, 55], label: 'DELEGATION, AT THE LINE OF CODE' },
};

function ProductShot({ number, chapter, title, clip, crop, note, frameWidth = 1720 }: { number: string; chapter: string; title: React.ReactNode; clip: string; crop: Crop; note?: string; frameWidth?: number }) {
  const f = useCurrentFrame();
  const detail = details[clip];
  const width = Math.min(frameWidth, 1180);
  const cardWidth = clip.startsWith('10_') ? 1050 : 850;
  const cardHeight = detail ? cardWidth * detail.crop[3] / detail.crop[2] : 0;
  const t = ease(f, 65, 32);
  return <AbsoluteFill>
    <Chapter number={number}>{chapter}</Chapter>
    <Headline size={74} centered={['04_', '06_', '12_'].some((prefix) => clip.startsWith(prefix))}>{title}</Headline>
    <Footage clip={clip} crop={crop} width={width} left={detail ? 210 : (1920 - width) / 2} top={215} />
    {detail && <div style={{ position: 'absolute', right: 100, top: 786, width: cardWidth, height: cardHeight + 52, borderRadius: 18, background: 'var(--surface)', border: `1px solid ${C.line}`, boxShadow: '0 24px 48px var(--shadow)', overflow: 'hidden', opacity: t, transform: `perspective(1800px) translateY(${(1 - t) * 95 + Math.sin(f / 60) * 3}px) rotateX(${(1 - t) * -12}deg) scale(${0.93 + t * 0.07})` }}>
      <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 13, padding: '0 24px', color: C.mint, fontSize: 16, letterSpacing: 2.5 }}><span style={{ width: 6, height: 6, background: C.mint, borderRadius: 10 }} />{detail.label}<span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted, letterSpacing: 1 }}>SOURCE DETAIL</span></div>
      <div style={{ position: 'relative', height: cardHeight }}><ScreenMedia clip={clip} crop={detail.crop} width={cardWidth} height={cardHeight} still /></div>
    </div>}
    {note && <div style={{ position: 'absolute', right: 120, top: 245, fontSize: 16, color: C.muted, fontFamily: mono, ...appear(f, 28) }}>{note}</div>}
  </AbsoluteFill>;
}

function Node({ x, y, w = 500, title, subtitle, delay, mint = false }: { x: number; y: number; w?: number; title: string; subtitle: string; delay: number; mint?: boolean }) {
  const f = useCurrentFrame();
  const color = mint ? C.mint : C.cyan;
  return <div style={{ position: 'absolute', left: x, top: y, width: w, height: 128, padding: '24px 28px', border: `1px solid ${color}`, background: 'var(--surface)', borderRadius: 17, boxShadow: '0 12px 40px var(--shadow)', ...appear(f, delay) }}>
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
    <Headline size={77} centered>Follow the structure.</Headline>
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

// Animate the supplied artwork as one piece: the SVG embeds a single PNG.
// The brief cameos stay outside product screens and brand text.
function Codi({ duration, learning = false }: { duration: number; learning?: boolean }) {
  const f = useCurrentFrame();
  const enter = spring({ frame: f, fps: FPS, config: { damping: 15, stiffness: 125, mass: 0.7 } });
  const exit = 1 - ease(f, duration - 14, 13);
  const settle = ease(f, 28, 20);
  const rock = Math.sin(Math.max(0, f - 24) / 9) * 3 * settle;
  const bob = Math.sin(Math.max(0, f - 24) / 13) * 5 * settle;
  const width = learning ? 205 : 230;
  return <div style={{ position: 'absolute', right: 105, top: learning ? 675 : 704, width, opacity: ease(f, 0, 10) * exit, transformOrigin: '50% 100%', transform: `translateY(${(1 - enter) * 100 + bob + (1 - exit) * 55}px) rotate(${rock}deg) scale(${0.88 + enter * 0.12})` }}>
    <Img src={staticFile('devices/codi.svg')} alt="Codi, the CodiNeo mascot" style={{ width: '100%', display: 'block' }} />
    <div style={{ textAlign: 'center', marginTop: 5, fontSize: 19, fontWeight: 600, letterSpacing: 2, color: C.muted }}>Codi</div>
  </div>;
}

export type AVPProps = { voiceover?: string; music?: boolean };
export function AVP({ voiceover, music = true }: AVPProps) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ ...themeStyle(sceneIndex(f) % 2 === 0), color: C.ink, fontFamily: sans, background: C.bg }}>
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
    <Sequence from={690} durationInFrames={150}><Codi duration={150} /></Sequence>
    <Sequence from={1545} durationInFrames={130}><Codi duration={130} learning /></Sequence>
    <Sequence from={3315} durationInFrames={165}><Codi duration={165} /></Sequence>
    <ShapeWipe />
    {music && <Audio src={staticFile('score.wav')} volume={voiceover ? 0.36 : 0.7} />}
    {voiceover && <Audio src={staticFile(voiceover)} volume={1} />}
    <AbsoluteFill style={{ pointerEvents: 'none', background: C.bg, opacity: interpolate(f, [0, 12, DURATION - 14, DURATION - 1], [1, 0, 0, 1], clamp) }} />
  </AbsoluteFill>;
}

registerRoot(() => <Composition id="CodiNeoAVP" component={AVP} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={{ music: true }} />);
