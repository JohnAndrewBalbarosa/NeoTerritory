import fs from 'node:fs';
import path from 'node:path';
import bcrypt from '../Backend/node_modules/bcryptjs';
import { assertDemoDirectory } from './isolation.mjs';
import { ROOT } from './config.mjs';

async function main() {
  const state = process.env.AVP_STATE_DIR;
  if (!state || process.env.DB_PATH !== path.join(state, 'demo.sqlite') || process.env.HOST !== '127.0.0.1') {
    throw new Error('Run this worker through the isolated AVP CLI');
  }
  assertDemoDirectory(ROOT, state);
  const marker = JSON.parse(fs.readFileSync(path.join(state, 'marker.json'), 'utf8'));
  if (marker.kind !== 'codineo-avp' || marker.root !== ROOT) throw new Error('Invalid demo ownership marker');
  if (process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_KEY) throw new Error('Cloud access is forbidden for demo seeding');
  // These imports open SQLite. They must occur only after all ownership checks.
  const { default: db } = await import('../Backend/src/db/database');
  const { initDb } = await import('../Backend/src/db/initDb');
  if (process.argv[2] === 'serve') {
    await import('../Backend/server');
    // initDb seeds this unrelated pilot on every boot. Remove it only in this owned demo DB.
    db.prepare("DELETE FROM learning_plan_modules WHERE plan_id = 'pilot-plan-001'").run();
    db.prepare("DELETE FROM learning_plans WHERE id = 'pilot-plan-001'").run();
    db.prepare("DELETE FROM users WHERE username = 'pilot-learner'").run();
    return;
  } else if (process.argv[2] === 'reset') {
    initDb();
    const credentials = JSON.parse(fs.readFileSync(path.join(state, 'credentials.json'), 'utf8'));
    db.transaction(() => {
      db.prepare("DELETE FROM learning_plan_modules WHERE plan_id = 'pilot-plan-001'").run();
      db.prepare("DELETE FROM learning_plans WHERE id = 'pilot-plan-001'").run();
      db.prepare("DELETE FROM users WHERE username = 'pilot-learner'").run();
      db.prepare('INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))')
        .run('AVP Intern', 'intern@avp.invalid', bcrypt.hashSync(credentials.internPassword, 10), 'user');
    })();
    const users = db.prepare('SELECT username, role FROM users ORDER BY id').all();
    fs.writeFileSync(path.join(state, 'seed-report.json'), JSON.stringify({ users, status: 'clean', assessmentsSeeded: false, projectTitle: 'Community Project Prioritization System' }, null, 2));
    console.log('Created clean demo accounts; no assessment outcomes or analysis runs were seeded.');
  } else if (process.argv[2] === 'recommend') {
    const { generateCoursePlan } = await import('../Backend/src/services/coursePlannerService');
    const prompt = fs.readFileSync(path.join(__dirname, 'project-specification.txt'), 'utf8');
    const plan = await generateCoursePlan({ prompt });
    fs.writeFileSync(path.join(state, 'recommendation.json'), JSON.stringify(plan, null, 2));
    const selected = plan.modules.filter((m) => m.published);
    console.log(JSON.stringify({ source: plan.source, selected: selected.map((m) => ({ id: m.moduleId, title: m.title })), required: plan.requiredLearning.map((m) => m.moduleId) }, null, 2));
    if (!selected.some((m) => m.moduleId === 'behavioural-strategy')) throw new Error('Real recommendation did not select Strategy; do not manufacture a recommendation');
  } else throw new Error('Unknown worker action');
  db.close();
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
