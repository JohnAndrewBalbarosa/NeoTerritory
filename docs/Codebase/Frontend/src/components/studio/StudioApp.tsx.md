# `StudioApp.tsx`

## Sole job

Host the standalone Studio and enforce its intern-learning prerequisite. Admins keep their existing direct access; interns must finish the Pre-Test, every required module, and the paired Post-Test.

```mermaid
flowchart TD
    Start["Open Studio"]
    N1["Load assessments"]
    N2["Load progress"]
    D1{"All learning gates done?"}
    N3["Render Studio"]
    N4["Show locked message"]
    N5["Return dashboard"]
    Start --> N1 --> N2 --> D1
    D1 -->|yes| N3
    D1 -->|no| N4 --> N5
```

## Acceptance checks

- Signed-out visitors still route to sign-in.
- Admin access remains unchanged.
- Interns without a Pre-Test, required-module completion, or Post-Test see the gate.
- Eligible interns can open Studio from the Intern Dashboard.
