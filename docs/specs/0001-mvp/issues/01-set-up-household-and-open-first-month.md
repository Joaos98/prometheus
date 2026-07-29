# 01 — Set up a Household and open its first Month

**What to build:** A household arriving at Prometheus for the first time chooses the currency every amount will be in, adds the Roster, and picks the Month to start from. That Month opens holding the active Roster and no rows — which is correct, not an error, since nothing precedes it — and renders in the Month dashboard's three-column shell. Closing the browser and returning shows the same Household.

This is the walking skeleton: it establishes the domain engine as a pure module with no framework or I/O imports, the storage port expressed in domain operations, the localStorage adapter behind it, the Vue/Vite build, and Vitest. Every later ticket adds capability through these seams rather than beside them.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Setup asks for a currency, a Roster of members, and a starting Month, and will not proceed without all three
- [ ] The chosen currency's decimal precision is recorded; amounts are stored and computed as integer minor units of it, never floating point
- [ ] The currency can be relabelled afterwards with no amount converted, and a change to a currency of different decimal precision is refused
- [ ] Opening the first Month yields an opened Month containing the active Roster and no rows; it is not Pending and not an error
- [ ] A Month is identified by year and month; an unopened Month is absent from the Household, which is distinct from an opened Month holding no rows
- [ ] Browsing a Month that has not been opened does not open it
- [ ] The dashboard renders the three columns of ADR-0010 with the Month's name centred in the header, and the design brief's palette, hairlines, radii and two font weights are in place from this ticket onward
- [ ] The domain engine is importable and testable with no browser, no adapter and no Vue
- [ ] The storage port is expressed in domain operations — load a Household, open a Month, write a row — and not as a mirror of an HTTP API
- [ ] Reloading the page restores the Household from localStorage
- [ ] Engine tests read as statements about the domain, using CONTEXT.md's vocabulary and honouring its _Avoid_ lists
