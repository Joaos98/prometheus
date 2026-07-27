# 02 — Household and member setup

**What to build:** Replace the hardcoded household with real setup. On first run the user sets the household currency once — immutable thereafter — and adds the household's members by name. Members can be renamed at any time, with the new name reflected everywhere including past Months. The dashboard renders one row per member. No login or auth anywhere: this is one private deployment serving one household.

**Blocked by:** 01 — Walking skeleton

**Status:** ready-for-agent

- [ ] First run requires setting the household currency before anything else; afterwards every amount in the app displays in it
- [ ] The currency cannot be changed after setup — no UI path exists, and the data layer rejects attempts
- [ ] Add a member by name; they appear on the dashboard immediately
- [ ] Rename a member; the change shows everywhere, including when browsing past Months
- [ ] Members and currency persist across app restarts via the data layer
- [ ] Engine seam: the monthly summary contains exactly one row per member
- [ ] No auth, login, or user-account concept is introduced
