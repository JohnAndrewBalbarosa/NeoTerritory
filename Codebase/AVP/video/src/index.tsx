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

// Transform-only atmosphere keeps the long render light while giving each shot depth.
function Backdrop() {
  const f = useCurrentFrame();
  const x = Math.sin(f / 260) * 100;
  const y = Math.cos(f / 310) * 65;
  return <AbsoluteFill style={{ background: '#061718', overflow: 'hidden' }}>
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 70% 62%, #237a6666, transparent 60%), linear-gradient(135deg, #071019, #082a2a 58%, #0d2620)' }} />
    <div style={{ position: 'absolute', inset: -250, background: 'radial-gradient(ellipse at 78% 30%, #61e7b25c, transparent 39%), radial-gradient(ellipse at 12% 72%, #02aabd55, transparent 42%)', transform: `translate(${x}px, ${y}px) rotate(${Math.sin(f / 400) * 8}deg)` }} />
    <svg width="2200" height="1250" viewBox="0 0 2200 1250" style={{ position: 'absolute', left: -130, top: -90, opacity: 0.54, transform: `translate(${-x * 0.45}px, ${y * 0.5}px) rotate(${Math.sin(f / 300) * 4}deg)` }}>
      <defs><linearGradient id="ribbon" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#11ad9b" stopOpacity="0.02" /><stop offset="0.48" stopColor="#50cfac" stopOpacity="0.3" /><stop offset="1" stopColor="#bbefbd" stopOpacity="0.7" /></linearGradient></defs>
      <path d="M-300 1130 C280 1700 790 0 1340 520 S2100 1320 2500 180" fill="none" stroke="url(#ribbon)" strokeWidth="210" />
      <path d="M-260 1130 C280 1700 790 0 1340 520 S2100 1320 2500 180" fill="none" stroke="#87eed5" strokeOpacity="0.16" strokeWidth="2" />
    </svg>
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #04111355, transparent 45%, #020c1377)' }} />
    <div style={{ position: 'absolute', left: -180, right: -180, bottom: -280, height: 650, borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 25%, #61cc9f20, transparent 65%)', borderTop: '1px solid #8be3c615', transform: `translateX(${x * 0.15}px)` }} />
    <div style={{ position: 'absolute', left: 100, right: 100, bottom: 63, height: 1, background: '#7ce8cd26' }} />
    <div style={{ position: 'absolute', left: 100, bottom: 26, fontSize: 16, letterSpacing: 4, color: '#b1d5cd' }}>CODINEO</div>
    <div style={{ position: 'absolute', right: 100, bottom: 26, fontFamily: mono, fontSize: 15, color: '#83b4ad' }}>C++ / DESIGN PATTERNS</div>
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
      const t = ease(f, delay + n * 2.4, 24);
      return <span key={`${n}-${i}`} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', paddingBottom: '0.08em', marginBottom: '-0.08em' }}><span style={{ display: 'inline-block', opacity: t, transform: `translateY(${(1 - t) * 112}%) rotate(${(1 - t) * 4}deg) scale(${0.94 + t * 0.06})` }}>{word}</span></span>;
    });
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.props.children) return React.cloneElement(child, {}, reveal(child.props.children));
    return child;
  });
  return <>{reveal(children)}</>;
}

function ShapeWipe() {
  const f = useCurrentFrame();
  const cuts = [630, 870, 1350, 1800, 2040, 2490, 2970, 3300];
  const cut = cuts.find((c) => Math.abs(f - c) < 13);
  if (cut === undefined) return null;
  const t = (f - cut + 13) / 26;
  return <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}><div style={{ position: 'absolute', width: 2500, height: 2500, borderRadius: '50%', top: -710, left: interpolate(t, [0, 1], [-2700, 2200]), background: 'linear-gradient(120deg, #72e5c4, #15bdb1 55%, #073e42)', transform: 'rotate(-25deg)' }} /></AbsoluteFill>;
}

function Chapter({ number, children }: { number: string; children: React.ReactNode }) {
  const f = useCurrentFrame();
  return <div style={{ position: 'absolute', top: 67, left: 100, fontSize: 18, fontWeight: 600, letterSpacing: 3.8, textTransform: 'uppercase', color: C.cyan, ...appear(f) }}>
    <span style={{ color: C.muted, marginRight: 28 }}>{number}</span>{children}
  </div>;
}

function Headline({ children, size = 80, top = 118 }: { children: React.ReactNode; size?: number; top?: number }) {
  return <div style={{ position: 'absolute', left: 100, top, right: 90, fontSize: size, fontWeight: 700, letterSpacing: -3.5, lineHeight: 1.06, }}><KineticText delay={4}>{children}</KineticText></div>;
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
    <AbsoluteFill style={{ background: 'linear-gradient(90deg, #061718 5%, #061718bb 48%, transparent)' }} />
    <Chapter number="00">The gap</Chapter>
    <div style={{ position: 'absolute', left: 100, top: 315, width: 1500, fontWeight: 700, letterSpacing: -5, fontSize: second ? 110 : 128, lineHeight: 1.06, ...appear(f, second ? 110 : 12) }}>
      <KineticText key={String(second)} delay={second ? 110 : 12}>{second ? <>BUT CAN YOU FIND IT<br /><span style={{ color: C.cyan }}>IN THE CODE?</span></> : <>YOU KNOW<br />THE PATTERN.</>}</KineticText>
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
    <div style={{ width: 580, height: 580, position: 'absolute', borderRadius: '50%', background: 'radial-gradient(circle, #71eab544, #18d8e500 70%)', transform: `scale(${1.6 + Math.sin(f / 65) * 0.15})` }} />
    <div style={{ textAlign: 'center', transform: `scale(${scale})`, ...{ opacity: ease(f, 0, 22) } }}>
      {!close && <div style={{ color: C.cyan, letterSpacing: 7, fontSize: 21, marginBottom: 38 }}>INTRODUCING</div>}
      <div style={{ fontWeight: 800, fontSize: 190, letterSpacing: -8, lineHeight: 1 }}><span style={{ display: 'inline-block', color: C.ink, transform: `translateX(${(1 - ease(f, 0, 35)) * -240}px)` }}>CODI</span><span style={{ display: 'inline-block', color: C.cyan, transform: `translateX(${(1 - ease(f, 0, 35)) * 240}px)` }}>NEO</span><span style={{ display: 'inline-block', color: C.mint, transform: `scale(${ease(f, 25, 20)})` }}>.</span></div>
      {close && <div style={{ fontSize: 43, letterSpacing: -0.8, lineHeight: 1.22, marginTop: 47, ...appear(f, 10) }}>FROM DESIGN-PATTERN THEORY<br />TO ACTUAL C++ IMPLEMENTATION.</div>}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: close ? 52 : 65 }}>
        {['LEARN.', 'ANALYZE.', 'UNDERSTAND.', 'DOCUMENT.'].map((text, i) => <span key={text} style={{ color: i === 0 ? C.mint : C.muted, fontSize: 25, letterSpacing: 2, ...appear(f, 18 + i * 12) }}>{text}</span>)}
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

function Footage({ clip, crop, width = 1540, left = 190, top = 290, laptop = false }: { clip: string; crop: Crop; width?: number; left?: number; top?: number; laptop?: boolean }) {
  const f = useCurrentFrame();
  const height = width * crop[3] / crop[2];
  const t = ease(f, 5, 36);
  const direction = Number(clip.slice(0, 2)) % 2 ? 1 : -1;
  const float = Math.sin(f / 70) * 3;
  const push = 1 + ease(f, 40, 200) * 0.015;
  return <div style={{ position: 'absolute', left, top, width, height: height + 108, perspective: 2200 }}>
    <div style={{ position: 'absolute', left: '12%', right: '12%', bottom: -6, height: 34, borderRadius: '50%', background: 'radial-gradient(ellipse, #0009, transparent 72%)', transform: `scaleX(${0.85 + t * 0.15})`, opacity: t }} />
    <div style={{ position: 'absolute', inset: 0, opacity: t, transformStyle: 'preserve-3d', transform: `translateY(${(1 - t) * 120 + float}px) rotateY(${direction * (1 - t) * 15}deg) rotateX(${(1 - t) * 9}deg) rotateZ(${direction * (1 - t) * 3}deg) scale(${(0.88 + t * 0.12) * push})` }}>
      {!laptop && <>
        <div style={{ position: 'absolute', width: 132, height: 98, top: height + 16, left: 'calc(50% - 66px)', background: 'linear-gradient(90deg, #1a2a2b, #75918b 44%, #334d4a 73%, #172829)', clipPath: 'polygon(26% 0, 74% 0, 86% 100%, 14% 100%)' }} />
        <div style={{ position: 'absolute', width: 420, height: 19, top: height + 99, left: 'calc(50% - 210px)', background: 'linear-gradient(#819991, #324946 48%, #122325)', borderRadius: '55% 55% 10px 10px', border: '1px solid #829b8d55' }} />
      </>}
      <div style={{ position: 'absolute', left: -15, right: -15, top: -20, height: height + 59, borderRadius: 26, padding: '20px 15px 39px', background: 'linear-gradient(125deg, #b6cbc1 0%, #38514e 9%, #0d171a 28%, #29433d 75%, #8ba59a 100%)', boxShadow: '0 28px 65px #0007, inset 0 0 0 1px #bbd2c066' }}>
        <div style={{ position: 'absolute', top: 7, left: 'calc(50% - 3px)', height: 6, width: 6, borderRadius: '50%', background: '#03080c', boxShadow: 'inset 0 0 0 2px #294348' }} />
        <div style={{ position: 'relative', width, height, borderRadius: 9, overflow: 'hidden', outline: '3px solid #040b0d' }}><ScreenMedia clip={clip} crop={crop} width={width} height={height} /></div>
        <div style={{ position: 'absolute', bottom: 13, left: 'calc(50% - 16px)', width: 32, height: 3, borderRadius: 5, background: '#92b3a866' }} />
        <div style={{ position: 'absolute', top: 1, left: 25, right: 25, height: 1, background: 'linear-gradient(90deg, transparent, #ecfff5b0, transparent)' }} />
      </div>
      {laptop && <div style={{ position: 'absolute', left: -70, right: -70, top: height + 38, height: 48, background: 'linear-gradient(#a5b9b1, #526760 40%, #263c38 45%, #0f211f)', clipPath: 'polygon(4% 0, 96% 0, 100% 65%, 98% 95%, 2% 95%, 0 65%)', borderRadius: '0 0 28px 28px', boxShadow: '0 18px 20px #0007' }}><div style={{ width: 150, height: 8, background: '#213d35', borderRadius: '0 0 10px 10px', margin: '0 auto' }} /></div>}
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
  const laptop = ['03_', '04_', '06_', '11_', '12_'].some((prefix) => clip.startsWith(prefix));
  const width = detail ? 1430 : Math.min(frameWidth, laptop ? 1460 : 1540, 570 * crop[2] / crop[3]);
  const cardWidth = clip.startsWith('10_') ? 1190 : 980;
  const cardHeight = detail ? cardWidth * detail.crop[3] / detail.crop[2] : 0;
  const t = ease(f, 65, 32);
  return <AbsoluteFill>
    <Chapter number={number}>{chapter}</Chapter>
    <Headline size={74}>{title}</Headline>
    <Footage clip={clip} crop={crop} width={width} left={detail ? 135 : (1920 - width) / 2} top={detail ? 295 : 300} laptop={laptop} />
    {detail && <div style={{ position: 'absolute', right: 100, top: 786, width: cardWidth, height: cardHeight + 52, borderRadius: 18, background: '#122829', border: '1px solid #8ddfbe88', boxShadow: '0 24px 48px #0009', overflow: 'hidden', opacity: t, transform: `perspective(1800px) translateY(${(1 - t) * 95 + Math.sin(f / 60) * 3}px) rotateX(${(1 - t) * -12}deg) scale(${0.93 + t * 0.07})` }}>
      <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 13, padding: '0 24px', color: '#bcf9d3', fontSize: 16, letterSpacing: 2.5 }}><span style={{ width: 6, height: 6, background: C.mint, borderRadius: 10 }} />{detail.label}<span style={{ marginLeft: 'auto', fontSize: 12, color: '#8fbbb0', letterSpacing: 1 }}>SOURCE DETAIL</span></div>
      <div style={{ position: 'relative', height: cardHeight }}><ScreenMedia clip={clip} crop={detail.crop} width={cardWidth} height={cardHeight} still /></div>
    </div>}
    {note && <div style={{ position: 'absolute', right: 120, top: 245, fontSize: 16, color: '#b7d6d0', fontFamily: mono, ...appear(f, 28) }}>{note}</div>}
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
    <ShapeWipe />
    {music && <Audio src={staticFile('score.wav')} volume={voiceover ? 0.36 : 0.7} />}
    {voiceover && <Audio src={staticFile(voiceover)} volume={1} />}
    <AbsoluteFill style={{ pointerEvents: 'none', background: C.bg, opacity: interpolate(f, [0, 12, DURATION - 14, DURATION - 1], [1, 0, 0, 1], clamp) }} />
  </AbsoluteFill>;
}

registerRoot(() => <Composition id="CodiNeoAVP" component={AVP} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={{ music: true }} />);
