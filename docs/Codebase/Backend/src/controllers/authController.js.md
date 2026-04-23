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

## File Outline
### Responsibility

This controller implements the authentication story of the backend. It receives registration or login payloads, validates the required fields, queries the database, hashes or compares credentials, records audit logs, and returns either a JWT or an error response.

### Position In The Flow

Runs after routing and middleware resolution to perform request-specific backend work.

### Main Surface Area

Implements HTTP endpoint behavior after routing and before response serialization. The main surface area is easiest to track through symbols such as bcrypt, jwt, db, and register. It collaborates directly with bcrypt, jsonwebtoken, ../db/database, and ../services/logService.

## File Activity
```mermaid
flowchart TD
    Start([Start])
    N0[Run login() to validate conditions and branch on failures, query or update SQLite state, and hash or compare credentials]
    N1[Run register() to validate conditions and branch on failures, query or update SQLite state, and hash or compare credentials]
    End([End])
    Start --> N0
    N0 --> N1
    N1 --> End
```

## Function Walkthrough

### register
This routine connects discovered items back into the broader model owned by the file. It appears near line 5.

Inside the body, it mainly handles validate conditions and branch on failures, query or update SQLite state, hash or compare credentials, and return the HTTP response.

It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

Key operations:
- validate conditions and branch on failures
- query or update SQLite state
- hash or compare credentials
- return the HTTP response

Activity:
```mermaid
flowchart TD
    Start([register()])
    N0[Enter register()]
    N1[Validate conditions and branch on failures]
    N2[Query or update SQLite state]
    N3[Hash or compare credentials]
    N4[Return the HTTP response]
    N5[Return the result to the caller]
    End([Return])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> End
```

### login
This routine owns one focused piece of the file's behavior. It appears near line 25.

Inside the body, it mainly handles validate conditions and branch on failures, query or update SQLite state, hash or compare credentials, and sign or verify JWT tokens.

It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

Key operations:
- validate conditions and branch on failures
- query or update SQLite state
- hash or compare credentials
- sign or verify JWT tokens
- return the HTTP response

Activity:
```mermaid
flowchart TD
    Start([login()])
    N0[Enter login()]
    N1[Validate conditions and branch on failures]
    N2[Query or update SQLite state]
    N3[Hash or compare credentials]
    N4[Sign or verify JWT tokens]
    N5[Return the HTTP response]
    N6[Return the result to the caller]
    End([Return])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.

