# 15 — Export and import the whole Household as JSON

**What to build:** A member exports the entire Household to a JSON file and imports it back with nothing lost. This answers two things at once: a self-hoster gets a backup that does not involve touching Docker volumes, and the demo stops being a dead end — export what you were trying, import it into your own deployment.

Import replaces the current Household wholesale, so it says what it will replace before it happens. A file it cannot read fails cleanly and changes nothing, rather than leaving a half-migration.

**Blocked by:** 09, 11

**Status:** ready-for-agent

- [ ] The whole Household exports to a single JSON file — currency, Roster, and every opened Month with all its rows
- [ ] Importing that file reproduces the Household exactly, and every figure recomputes to the same values
- [ ] A null amount round-trips as null, an explicit zero as zero, and an absent row as absent — the three stay distinct through export and import
- [ ] Review state round-trips, so an Unreviewed row is still Unreviewed after an import
- [ ] Stable identities round-trip, so propagation and history still follow the same threads
- [ ] One-Off flags, Restricted-Use flags, Participants and Split Rules all round-trip
- [ ] Import reports what it will replace before proceeding
- [ ] A file that fails validation is rejected and the current Household is left completely unchanged
- [ ] Export and import work in both builds
- [ ] The Viewer preference and the restricted-use display toggle are not in the export — they are not Household data
