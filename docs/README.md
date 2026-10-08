# Shield Documentation

> All documentation lives here. Start with [setup](./guides/SETUP.md), then read whichever section you need.

## Index

| Document | Purpose |
|---|---|
| [guides/SETUP.md](./guides/SETUP.md) | Full local development setup from scratch |
| [guides/AUTH.md](./guides/AUTH.md) | Authentication system deep-dive |
| [guides/MOBILE.md](./guides/MOBILE.md) | Mobile app architecture, screens, hooks, state |
| [architecture/OVERVIEW.md](./architecture/OVERVIEW.md) | System architecture, data flow, security model |
| [architecture/DATABASE.md](./architecture/DATABASE.md) | Firestore schema, collections, indexes, relationships |
| [architecture/REQUEST_FLOW.md](./architecture/REQUEST_FLOW.md) | **Complete request flow diagrams — every layer annotated** |
| [api/REFERENCE.md](./api/REFERENCE.md) | Complete REST API reference |
| [api/ERRORS.md](./api/ERRORS.md) | Error codes, response shapes, troubleshooting |

## Quick orientation

```
Shield-app/
├── artifacts/mobile/      ← Expo React Native app (TypeScript)
├── server/                ← Express + Firestore backend (TypeScript)
├── lib/
│   ├── api-clients-react/ ← Orval-generated TanStack Query hooks
│   ├── api-spec/          ← OpenAPI 0.1.0 spec (source for codegen)
│   └── api-zod/           ← Generated Zod validators
└── docs/                  ← You are here
```

The mobile app **never** connects directly to Firestore. All data flows through the REST API.
