# localDevelopmentAccess.ts

- Source: `Backend/src/services/localDevelopmentAccess.ts`
- Kind: authentication environment policy

## Story

This service owns the production boundary for the local Test Intern login. Development and test runtimes may provision the stable local learner; production may not.

```mermaid
flowchart TD
    A[Read runtime] --> B{Production?}
    B -->|yes| C[Deny Test Intern]
    B -->|no| D[Allow local access]
```

## Acceptance Checks

- Missing, development, and test environments allow local Test Intern access.
- Production disables the endpoint.
