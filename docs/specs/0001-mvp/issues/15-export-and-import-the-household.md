# 15 — Export and import the whole Household as JSON

**What to build:** A member exports the entire Household to a JSON file and imports it back with nothing lost. This answers two things at once: a self-hoster gets a backup that does not involve touching Docker volumes, and the demo stops being a dead end — export what you were trying, import it into your own deployment.

Import replaces the current Household wholesale, so it says what it will replace before it happens. A file it cannot read fails cleanly and changes nothing, rather than leaving a half-migration.

**Blocked by:** 09, 11

**Status:** done

**Suggested model:** Opus, medium thinking — validation has to be all-or-nothing, and null-vs-zero has to survive the JSON in both directions.

- [x] The whole Household exports to a single JSON file — currency, Roster, and every opened Month with all its rows
- [x] Importing that file reproduces the Household exactly, and every figure recomputes to the same values
- [x] A null amount round-trips as null, an explicit zero as zero, and an absent row as absent — the three stay distinct through export and import
- [x] Review state round-trips, so an Unreviewed row is still Unreviewed after an import
- [x] Stable identities round-trip, so propagation and history still follow the same threads
- [x] One-Off flags, Restricted-Use flags, Participants and Split Rules all round-trip
- [x] Import reports what it will replace before proceeding
- [x] A file that fails validation is rejected and the current Household is left completely unchanged
- [x] Export and import work in both builds
- [x] The Viewer preference and the restricted-use display toggle are not in the export — they are not Household data

## Comments

**Both directions are pure, and that is what makes rejection safe.** `importHousehold` reads a
file through and returns the Household it describes without touching anything, so there is no
path where a file half-arrives: it either produces a whole Household or throws, and the store
is never called. The panel reads the chosen file through as soon as it is chosen, so a bad
file is refused before the member is ever asked whether to replace anything.

**The file is read out field by field and the Household rebuilt from what was read**, rather
than the parsed JSON being cast to `Household` and trusted. That is what makes a hand-edited
file safe to accept: an Expense dividing among somebody who is not a member of its Month, a
percentage rule totalling 90, a Contribution from somebody not saving for the goal and a Month
filed under a key it does not carry are each refused, in the same words the engine refuses a
member's own edit. It also drops any field the format does not know, so nothing rides along.

**A missing `amount` field is rejected rather than read as null.** Null is Pending — a real
answer — and a file that simply does not mention an amount is not making that claim, so it is
refused instead of being guessed at. This is the spec's riskiest distinction and it has a test
each way: null stays null, zero stays zero, and a removed row stays absent.

**Nothing said the export needed a date or a Household name**, so it carries neither: a marker,
a format number, and the three things a Household is. The format number is checked, and a file
written by a later Prometheus is refused with a sentence saying so rather than half-read.

**"Both builds" costs nothing here.** Export serialises the in-memory Household and import goes
through the port's `replaceHousehold`, so the SQLite adapter of ticket 16 inherits both with no
work. Ticket 17 must keep the Viewer and its toggle out of the `Household` value — the export
carries the Household's three fields and nothing else, and that is the only thing keeping a
device preference out of the file.
