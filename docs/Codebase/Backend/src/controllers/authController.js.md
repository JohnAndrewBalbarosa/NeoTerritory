# authController.js

- Source: Backend/src/controllers/authController.js
- Kind: JavaScript module
- Lines: 49
- Role: Implements HTTP endpoint behavior after routing and before response serialization.
- Chronology: Runs after routing and middleware resolution to perform request-specific backend work.

## Notable Symbols
- bcrypt
- jwt
- db
- register
- userExists
- hash
- stmt
- info
- login
- user
- valid
- token

## Direct Dependencies
- bcrypt
- jsonwebtoken
- ../db/database
- ../services/logService

## Implementation Story
This controller implements the authentication story of the backend. It receives registration or login payloads, validates the required fields, queries the database, hashes or compares credentials, records audit logs, and returns either a JWT or an error response. Implements HTTP endpoint behavior after routing and before response serialization. Runs after routing and middleware resolution to perform request-specific backend work. The implementation surface is easiest to recognize through symbols such as bcrypt, jwt, db, and register. In practice it collaborates directly with bcrypt, jsonwebtoken, ../db/database, and ../services/logService.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Run register() to validate conditions and branch on failures, query or update SQLite state, and hash or compare credentials]
    N1[Run login() to validate conditions and branch on failures, query or update SQLite state, and hash or compare credentials]
    End([End])
    Start --> N0
    N0 --> N1
    N1 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-22 after reading the existing docs corpus and the current source tree.

