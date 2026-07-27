# 02 — Household and member setup

**What to build:** Replace the hardcoded household with real setup. On first run the user sets the household currency once — immutable thereafter — and adds the household's members by name. Members can be renamed at any time, with the new name reflected everywhere including past Months. The dashboard renders one row per member. No login or auth anywhere: this is one private deployment serving one household.

**Blocked by:** 01 — Walking skeleton

**Status:** ready-for-agent

- [x] First run requires setting the household currency before anything else; afterwards every amount in the app displays in it
- [x] The currency cannot be changed after setup — no UI path exists, and the data layer rejects attempts
- [x] Add a member by name; they appear on the dashboard immediately
- [x] Rename a member; the change shows everywhere, including when browsing past Months
- [x] Members and currency persist across app restarts via the data layer
- [x] Engine seam: the monthly summary contains exactly one row per member
- [x] No auth, login, or user-account concept is introduced

## Comments

Implemented. Extended the DataStore interface with granular operations (`getCurrency`, `setCurrency`, `addMember`, `getMembers`, `renameMember`); added 8 contract tests covering null-currency state, set-once enforcement, member insertion order, rename persistence, and missing-member error. Server replaced the hardcoded seed with REST endpoints: GET /api/household, POST /api/household/currency, POST /api/members, PATCH /api/members/:id. Client handles two modes — setup screen (currency-first, add members) before currency exists, dashboard afterward. Smoke tests cover both modes. E2E verified: initial null currency, set to EUR, 409 on second attempt, member CRUD, summary reflects members.
