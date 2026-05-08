// Static catalog of design patterns the microservice can detect.
// Each entry shows: tag chips, the live source from
// Codebase/Microservice/samples/, the generated unit-test template from
// Codebase/Microservice/pattern_catalog/, and a per-pattern explanation
// of what the test asserts.
//
// Everything here is a `?raw` import — no runtime fetch, no API call.
// The page is fully static; the only dynamic surface is the
// "Try in studio" button which routes to /app for an actual analyzer run.

import { navigate } from '../../logic/router';

import builderSrc from '../../../../Microservice/samples/builder/http_request_builder.cpp?raw';
import factorySrc from '../../../../Microservice/samples/factory/shape_factory.cpp?raw';
import singletonSrc from '../../../../Microservice/samples/singleton/config_registry.cpp?raw';
import methodChainSrc from '../../../../Microservice/samples/method_chaining/query_predicate.cpp?raw';
import strategySrc from '../../../../Microservice/samples/strategy/strategy_basic.cpp?raw';
import wrappingSrc from '../../../../Microservice/samples/wrapping/logging_proxy.cpp?raw';

import builderTpl from '../../../../Microservice/pattern_catalog/creational/builder.test.template.cpp?raw';
import factoryTpl from '../../../../Microservice/pattern_catalog/creational/factory.test.template.cpp?raw';
import singletonTpl from '../../../../Microservice/pattern_catalog/creational/singleton.test.template.cpp?raw';
import methodChainTpl from '../../../../Microservice/pattern_catalog/creational/method_chaining.test.template.cpp?raw';
import strategyInterfaceTpl from '../../../../Microservice/pattern_catalog/behavioural/strategy_interface.test.template.cpp?raw';
import strategyConcreteTpl from '../../../../Microservice/pattern_catalog/behavioural/strategy_concrete.test.template.cpp?raw';
import decoratorTpl from '../../../../Microservice/pattern_catalog/structural/decorator.test.template.cpp?raw';

type Family = 'Creational' | 'Behavioural' | 'Structural';

interface Substitution {
  key: string;
  value: string;
  source: string; // where the value came from in the detector output
}

interface PatternEntry {
  id: string;
  family: Family;
  title: string;
  tags: string[];
  summary: string;
  sampleFile: string;
  sampleSource: string;
  templateFile: string;
  templateSource: string;
  substitutions: Substitution[];
  testAsserts: string[];
  runStatus: string;
}

const ENTRIES: PatternEntry[] = [
  {
    id: 'creational.builder',
    family: 'Creational',
    title: 'Builder',
    tags: ['creational', 'builder', 'fluent setters', 'co-emits: method_chaining'],
    summary:
      'Fluent setters that each return *this, paired with a terminator method (build / finalize / done / complete / produce) that yields the product.',
    sampleFile: 'samples/builder/http_request_builder.cpp',
    sampleSource: builderSrc,
    templateFile: 'pattern_catalog/creational/builder.test.template.cpp',
    templateSource: builderTpl,
    substitutions: [
      { key: '{{CLASS_NAME}}', value: 'HttpRequestBuilder', source: 'detector.class_name' },
      { key: '{{TERMINATOR}}', value: 'build', source: 'detector.unit_test_targets[0]' },
      { key: '{{HEADER}}', value: 'http_request_builder.hpp', source: 'derived from sample filename' },
    ],
    testAsserts: [
      'static_assert that the captured class is actually a class type — compiles only if the detector targeted a real symbol.',
      'is_default_constructible<T> via if-constexpr — a Builder must be cheap to instantiate empty.',
      'Probes for the exact terminator the detector named. Falls back through build / finalize / done / complete / produce so renamed terminators still get exercised.',
      'Calls the terminator with zero args and emits "pass". If no zero-arg terminator exists the test emits "skip" — never silently passes.',
    ],
    runStatus: 'Verified · runs in Codebase/Microservice/Test/integration',
  },
  {
    id: 'creational.factory',
    family: 'Creational',
    title: 'Factory',
    tags: ['creational', 'factory', 'branching create()'],
    summary:
      'A class with a create(kind) (or named equivalent) that branches on its argument and returns one of several concrete subtypes.',
    sampleFile: 'samples/factory/shape_factory.cpp',
    sampleSource: factorySrc,
    templateFile: 'pattern_catalog/creational/factory.test.template.cpp',
    templateSource: factoryTpl,
    substitutions: [
      { key: '{{CLASS_NAME}}', value: 'ShapeFactory', source: 'detector.class_name' },
      { key: '{{FACTORY_FN}}', value: 'create', source: 'detector.unit_test_targets[0]' },
    ],
    testAsserts: [
      'Class type check + default-constructibility (a Factory should not require config to instantiate).',
      'Probes for the captured factory method name; if it exists and is callable with no args, emits "pass".',
      'If the factory method requires arguments, the test honestly emits "skip" — the detector still flags the pattern but the runtime exercise is deferred to a hand-written follow-up.',
    ],
    runStatus: 'Verified · runs in Codebase/Microservice/Test/integration',
  },
  {
    id: 'creational.singleton',
    family: 'Creational',
    title: 'Singleton',
    tags: ['creational', 'singleton', 'identity invariant'],
    summary:
      'Single global instance enforced by a deleted copy constructor and a static accessor (instance / getInstance / sharedInstance / getDefault / get_instance / GetInstance).',
    sampleFile: 'samples/singleton/config_registry.cpp',
    sampleSource: singletonSrc,
    templateFile: 'pattern_catalog/creational/singleton.test.template.cpp',
    templateSource: singletonTpl,
    substitutions: [
      { key: '{{CLASS_NAME}}', value: 'ConfigRegistry', source: 'detector.class_name' },
      { key: '{{HEADER}}', value: 'config_registry.hpp', source: 'derived from sample filename' },
    ],
    testAsserts: [
      'singleton_copy_deleted<T> — copy ctor must be deleted, otherwise emits a real "fail".',
      'Calls whichever static accessor exists twice and asserts identity (&a == &b).',
      'Six accessor names are tried in order; the first match wins. If none exist, emits "skip" instead of inventing one.',
      'Per-call comments inside the if-constexpr branch tell the human reader exactly which accessor matched.',
    ],
    runStatus: 'Verified · runs in Codebase/Microservice/Test/integration',
  },
  {
    id: 'creational.method_chaining',
    family: 'Creational',
    title: 'Method Chaining',
    tags: ['creational', 'method chaining', 'no terminator'],
    summary:
      'Same fluent return *this shape as Builder, but no terminator. The detector deliberately emits this WITHOUT creational.builder so the two are distinguishable.',
    sampleFile: 'samples/method_chaining/query_predicate.cpp',
    sampleSource: methodChainSrc,
    templateFile: 'pattern_catalog/creational/method_chaining.test.template.cpp',
    templateSource: methodChainTpl,
    substitutions: [
      { key: '{{CLASS_NAME}}', value: 'QueryPredicate', source: 'detector.class_name' },
    ],
    testAsserts: [
      'Lighter-weight test than Builder: just confirms a chain can begin from a default-constructed instance.',
      'Each fluent call composes into the same expression statement, so a successful default-construction means the chain entry-point compiles.',
      'If the class is NOT default-constructible the test emits "skip" — chain entry points sometimes require config; the detector still flags the shape.',
    ],
    runStatus: 'Verified · runs in Codebase/Microservice/Test/integration',
  },
  {
    id: 'behavioural.strategy',
    family: 'Behavioural',
    title: 'Strategy (interface + concrete)',
    tags: ['behavioural', 'strategy_interface', 'strategy_concrete', 'inheritance cascade'],
    summary:
      'An abstract base with one or more pure virtuals (the interface) plus one or more derived classes that implement them (the concretes). The detector emits BOTH tags and an inheritance cascade so each concrete inherits a parent role hint without a fresh AI round-trip.',
    sampleFile: 'samples/strategy/strategy_basic.cpp',
    sampleSource: strategySrc,
    templateFile:
      'pattern_catalog/behavioural/strategy_interface.test.template.cpp + strategy_concrete.test.template.cpp',
    templateSource: `// ── strategy_interface.test.template.cpp ──\n${strategyInterfaceTpl}\n\n// ── strategy_concrete.test.template.cpp ──\n${strategyConcreteTpl}`,
    substitutions: [
      { key: '{{CLASS_NAME}} (interface)', value: 'Compressor', source: 'detector.class_name (parent)' },
      { key: '{{CLASS_NAME}} (concrete)', value: 'ZipCompressor / GzipCompressor', source: 'detector.cascaded_subtypes' },
      { key: '{{TARGET_METHOD}}', value: 'compress', source: 'detector.unit_test_targets[0]' },
    ],
    testAsserts: [
      'Interface test: asserts std::is_abstract_v<T> — the interface must be abstract, otherwise consumers can bypass the strategy contract.',
      'Concrete test: asserts the derived class is NOT abstract; if it still is, at least one inherited pure-virtual is unimplemented and the test emits "fail".',
      'Concrete test then exercises the captured target_method on a default-constructed strategy and emits "pass".',
      'Detector emits one unit_test_target per polymorphic call site, so coverage scales with the number of dispatch points.',
    ],
    runStatus: 'Verified · runs in Codebase/Microservice/Test/integration',
  },
  {
    id: 'structural.wrapping',
    family: 'Structural',
    title: 'Adapter / Decorator / Proxy (co-emit)',
    tags: ['structural', 'adapter', 'decorator', 'proxy', 'wrapping co-emit'],
    summary:
      'A class that forwards method calls to a wrapped inner instance. Structurally identical to all three roles; the catalog co-emits all three and AI on the backend disambiguates which intent applies.',
    sampleFile: 'samples/wrapping/logging_proxy.cpp',
    sampleSource: wrappingSrc,
    templateFile: 'pattern_catalog/structural/decorator.test.template.cpp (one of three)',
    templateSource: decoratorTpl,
    substitutions: [
      { key: '{{CLASS_NAME}}', value: 'LoggingDataService', source: 'detector.class_name' },
      { key: '{{FORWARD_METHOD}}', value: 'fetch', source: 'detector.unit_test_targets[0]' },
    ],
    testAsserts: [
      'Compiles against the submission to confirm the wrapper class is well-formed.',
      'If a default constructor exists AND the forwarding method takes no args, calls it once and emits "pass".',
      'The common case (wrappers take an inner Component in their constructor) yields "skip" — the detector flags the pattern, but the runtime delegation check waits for a fixture. This is intentional honesty: no fake passes.',
      'Adapter and Proxy ship parallel templates with the same shape — only the criterion id and method name change.',
    ],
    runStatus: 'Verified · runs in Codebase/Microservice/Test/integration',
  },
];

function familyAccent(f: Family): string {
  if (f === 'Creational') return 'oklch(72% 0.18 250)';
  if (f === 'Behavioural') return 'oklch(72% 0.18 320)';
  return 'oklch(72% 0.18 160)';
}

function CodeBlock({ source, file }: { source: string; file: string }) {
  return (
    <figure className="nt-atlas__code">
      <figcaption className="nt-atlas__code-file">
        <span aria-hidden>📄</span>
        <code>{file}</code>
      </figcaption>
      <pre className="nt-atlas__code-pre">
        <code>{source}</code>
      </pre>
    </figure>
  );
}

function PatternCard({ entry }: { entry: PatternEntry }) {
  const accent = familyAccent(entry.family);
  return (
    <article className="nt-atlas__card" id={`atlas-${entry.id}`} style={{ ['--atlas-accent' as string]: accent }}>
      <header className="nt-atlas__card-head">
        <p className="nt-atlas__family" style={{ color: accent }}>
          {entry.family}
        </p>
        <h3 className="nt-atlas__title">{entry.title}</h3>
        <p className="nt-atlas__id">
          <code>pattern_id = {entry.id}</code>
        </p>
        <ul className="nt-atlas__tags" aria-label="Pattern tags">
          {entry.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="nt-atlas__summary">{entry.summary}</p>
      </header>

      <section className="nt-atlas__section" aria-labelledby={`${entry.id}-source`}>
        <h4 id={`${entry.id}-source`} className="nt-atlas__section-title">
          1 · Source — what the detector sees
        </h4>
        <CodeBlock source={entry.sampleSource} file={entry.sampleFile} />
        <p className="nt-atlas__status">
          <span className="nt-atlas__status-dot" aria-hidden /> {entry.runStatus}
        </p>
        <button
          type="button"
          className="nt-atlas__try"
          onClick={() => navigate('/app')}
          aria-label={`Try ${entry.title} in the studio`}
        >
          Try this in studio →
        </button>
      </section>

      <section className="nt-atlas__section" aria-labelledby={`${entry.id}-test`}>
        <h4 id={`${entry.id}-test`} className="nt-atlas__section-title">
          2 · Generated unit test — template + substitutions
        </h4>
        <table className="nt-atlas__subs">
          <thead>
            <tr>
              <th>Placeholder</th>
              <th>Filled with</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {entry.substitutions.map((s) => (
              <tr key={s.key}>
                <td><code>{s.key}</code></td>
                <td><code>{s.value}</code></td>
                <td className="nt-atlas__subs-src">{s.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <details className="nt-atlas__details">
          <summary>Show the raw template ({entry.templateFile})</summary>
          <CodeBlock source={entry.templateSource} file={entry.templateFile} />
        </details>
      </section>

      <section className="nt-atlas__section" aria-labelledby={`${entry.id}-explain`}>
        <h4 id={`${entry.id}-explain`} className="nt-atlas__section-title">
          3 · What the test actually asserts
        </h4>
        <ol className="nt-atlas__asserts">
          {entry.testAsserts.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      </section>
    </article>
  );
}

export default function PatternAtlas() {
  return (
    <div className="nt-atlas">
      <div className="nt-atlas__intro">
        <p>
          Each entry below is a real file pair: the C++ sample the detector reads, and the
          unit-test template it instantiates. The microservice fills the placeholders with values it
          captured (class names, method names, terminator names) and writes the materialised test to
          disk. None of the substitutions guess — every value is grounded in <code>unit_test_targets</code>
          {' '}from the detector output.
        </p>
      </div>
      <div className="nt-atlas__grid">
        {ENTRIES.map((e) => (
          <PatternCard key={e.id} entry={e} />
        ))}
      </div>
    </div>
  );
}
