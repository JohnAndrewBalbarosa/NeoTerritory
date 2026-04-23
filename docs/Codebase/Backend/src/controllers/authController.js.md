# authController.js

- Source: Backend/src/controllers/authController.js
- Kind: JavaScript module
- Lines: 49

## Story
### What Happens Here

This controller implements the authentication story of the backend. It receives registration or login payloads, validates the required fields, queries the database, hashes or compares credentials, records audit logs, and returns either a JWT or an error response.

### Why It Matters In The Flow

Runs after routing and middleware resolution to perform request-specific backend work.

### What To Watch While Reading

Implements HTTP endpoint behavior after routing and before response serialization. The main surface area is easiest to track through symbols such as bcrypt, jwt, db, and register. It collaborates directly with bcrypt, jsonwebtoken, ../db/database, and ../services/logService.

## Program Flow
This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Part 1
```mermaid
flowchart TD
    N0["Start"]
    N1["Finding what matters"]
    N2["Enter register()"]
    N3["Connect data"]
    N4["Validate branch"]
    N5["Continue?"]
    N6["Stop path"]
    N7["Use SQLite"]
    N8["Check credentials"]
    N9["Continue?"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
    N7 --> N8
    N8 --> N9
```

#### Part 2
```mermaid
flowchart TD
    N0["Stop path"]
    N1["Return result"]
    N2["Return result"]
    N3["Supporting steps"]
    N4["Enter login()"]
    N5["Validate branch"]
    N6["Continue?"]
    N7["Stop path"]
    N8["Use SQLite"]
    N9["Check credentials"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
    N7 --> N8
    N8 --> N9
```

#### Part 3
```mermaid
flowchart TD
    N0["Continue?"]
    N1["Stop path"]
    N2["Verify JWT"]
    N3["Continue?"]
    N4["Stop path"]
    N5["Return result"]
    N6["Return result"]
    N7["End"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
```

## Reading Map
Read this file as: Implements HTTP endpoint behavior after routing and before response serialization.

Where it sits in the run: Runs after routing and middleware resolution to perform request-specific backend work.

Names worth recognizing while reading: bcrypt, jwt, db, register, userExists, and hash.

It leans on nearby contracts or tools such as bcrypt, jsonwebtoken, ../db/database, and ../services/logService.

## Story Groups

### Finding What Matters
These steps pick out the facts, traces, and relationships that later stages need.
- register() (line 5): Connect discovered data back into the shared model, validate conditions and branch on failures, and query or update SQLite state

### Supporting Steps
These steps support the local behavior of the file.
- login() (line 25): Validate conditions and branch on failures, query or update SQLite state, and hash or compare credentials

## Function Stories

### register()
This routine connects discovered items back into the broader model owned by the file. It appears near line 5.

Inside the body, it mainly handles connect discovered data back into the shared model, validate conditions and branch on failures, query or update SQLite state, and hash or compare credentials.

It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- connect discovered data back into the shared model
- validate conditions and branch on failures
- query or update SQLite state
- hash or compare credentials
- return the HTTP response

Flow:

### Block 2 - register() Details
#### Part 1
```mermaid
flowchart TD
    N0["register()"]
    N1["Enter register()"]
    N2["Connect data"]
    N3["Validate branch"]
    N4["Continue?"]
    N5["Stop path"]
    N6["Use SQLite"]
    N7["Check credentials"]
    N8["Continue?"]
    N9["Stop path"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
    N7 --> N8
    N8 --> N9
```

#### Part 2
```mermaid
flowchart TD
    N0["Return result"]
    N1["Return result"]
    N2["Return"]
    N0 --> N1
    N1 --> N2
```

### login()
This routine owns one focused piece of the file's behavior. It appears near line 25.

Inside the body, it mainly handles validate conditions and branch on failures, query or update SQLite state, hash or compare credentials, and sign or verify JWT tokens.

It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- validate conditions and branch on failures
- query or update SQLite state
- hash or compare credentials
- sign or verify JWT tokens
- return the HTTP response

Flow:

### Block 3 - login() Details
#### Part 1
```mermaid
flowchart TD
    N0["login()"]
    N1["Enter login()"]
    N2["Validate branch"]
    N3["Continue?"]
    N4["Stop path"]
    N5["Use SQLite"]
    N6["Check credentials"]
    N7["Continue?"]
    N8["Stop path"]
    N9["Verify JWT"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
    N7 --> N8
    N8 --> N9
```

#### Part 2
```mermaid
flowchart TD
    N0["Continue?"]
    N1["Stop path"]
    N2["Return result"]
    N3["Return result"]
    N4["Return"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.
