# intern-dashboard route

## Sole job

Expose the browser-only Intern Dashboard at `/intern-dashboard`. The route delegates presentation and gate decisions to the shared frontend `InternDashboard` component.

```mermaid
flowchart TD
    Start["Open dashboard"]
    N1["Load client surface"]
    N2["Read learning status"]
    End["Show next gate"]
    Start --> N1 --> N2 --> End
```

The legacy `/student-dashboard` route redirects here for existing bookmarks.
