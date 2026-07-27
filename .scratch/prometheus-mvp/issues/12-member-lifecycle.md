# 12 — Member lifecycle: join and depart

**What to build:** Members join and depart Effective From a Month. Joining earlier than "now" is allowed but the member simply doesn't exist in earlier Months. Departing removes the member from all active expenses and goals from the departure Month onward — applied as an ordinary effective-dated participants change — while their Income, Shares, and Leftover Balances keep rendering in every past Month they were part of. Members referenced by any Month can never be deleted; an unreferenced member (a setup mistake) can be truly removed.

**Blocked by:** 07 — Month navigation and history browsing

**Status:** ready-for-agent

- [ ] Adding a member accepts a joined-Effective-From Month; Months before it exclude the member entirely (engine seam)
- [ ] Departing a member Effective From M removes them from all active expenses and goals from M onward, preserving their participation in earlier Months
- [ ] A departed member no longer appears as a Participant option for changes effective from their departure Month onward
- [ ] Browsing any past Month still renders the departed member's Income, Shares, and Leftover Balance for that Month
- [ ] A member referenced by no Month can be fully removed; a referenced member can only be departed, never deleted — the UI makes this distinction clear
- [ ] Engine seam: summaries for Months ≥ M contain no Shares for the departed member; earlier Months are byte-for-byte unchanged
