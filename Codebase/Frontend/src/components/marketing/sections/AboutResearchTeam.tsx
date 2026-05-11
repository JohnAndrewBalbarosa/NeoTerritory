// Structured Research-team block moved here from /research per this
// turn's restructure. Lists Authors / Advising / Panel explicitly with
// names + roles. The existing free-prose Acknowledgements section on
// /about stays — this block sits alongside it.

const AUTHORS: ReadonlyArray<{ name: string; role: string }> = [
  { name: 'John Andrew Balbarosa', role: 'Researcher' },
  { name: 'Miryl Z. De Leon', role: 'Researcher' },
  { name: 'Josephine J. Santander', role: 'Researcher' },
];

const ADVISING: ReadonlyArray<{ name: string; role: string }> = [
  { name: 'Ms. Kim Giselle Bautista', role: 'Thesis Adviser' },
  { name: 'Ms. Elisa Malasaga', role: 'Course Adviser' },
  { name: 'Dr. Shaneth C. Ambat', role: 'Department Head' },
];

const PANEL: ReadonlyArray<{ name: string; role: string }> = [
  { name: 'Dr. Hadji Tejuco', role: 'Head Panelist' },
  { name: 'Ms. May Florence San Pablo', role: 'Panelist' },
  { name: 'Dr. Dennis B. Gonzales', role: 'Panelist' },
];

export default function AboutResearchTeam() {
  return (
    <section className="nt-about__section" aria-labelledby="ab-team">
      <h2 id="ab-team" className="nt-about__section-title">
        Research team
      </h2>
      <div className="nt-research__people">
        <div className="nt-research__people-group">
          <h3>Authors</h3>
          <ul>
            {AUTHORS.map((a) => (
              <li key={a.name}>
                <strong>{a.name}</strong> &mdash; <span>{a.role}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="nt-research__people-group">
          <h3>Advising</h3>
          <ul>
            {ADVISING.map((a) => (
              <li key={a.name}>
                <strong>{a.name}</strong> &mdash; <span>{a.role}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="nt-research__people-group">
          <h3>Panel</h3>
          <ul>
            {PANEL.map((p) => (
              <li key={p.name}>
                <strong>{p.name}</strong> &mdash; <span>{p.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
