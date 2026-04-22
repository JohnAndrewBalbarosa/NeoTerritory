# initDb.js

- Source: Backend/src/db/initDb.js
- Kind: JavaScript module
- Lines: 33
- Role: Owns SQLite connectivity and schema initialization.
- Chronology: Supports backend startup and request-time persistence operations.

## Notable Symbols
- initDb
- db

## Direct Dependencies
- ./database

## Implementation Story
This file implements the database bootstrapping sequence. It creates the users, jobs, and logs tables if they do not already exist so the backend can start in a valid persistence state. This file lives in the persistence layer of the backend. Its implementation supports startup-time or request-time SQLite operations used by the HTTP layer.   Owns SQLite connectivity and schema initialization.   Supports backend startup and request-time persistence operations.  The implementation surface is easiest to recognize through symbols such as initDb and db.  In practice it collaborates directly with ./database.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Run initDb() to query or update SQLite state]
    End([End])
    Start --> N0
    N0 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-22 after reading the existing docs corpus and the current source tree.

