/**
 * The panels the masthead's settings buttons open. None of them is about the Month, which
 * is why each opens as a modal over it rather than as a card in its flow.
 */
export type SettingsPanel = 'roster' | 'categories' | 'household-file' | 'currency' | 'demo'

/**
 * What each modal is called, on screen and to a screen reader alike.
 *
 * All but one read their masthead button back word for word. The currency button carries
 * the Household's code and symbol rather than a word — it is a value, not a label — so its
 * modal is titled by what the value is, which is the one setting the panel changes.
 */
export const SETTINGS_TITLES: Record<SettingsPanel, string> = {
  roster: 'Roster',
  categories: 'Categories',
  'household-file': 'Household file',
  currency: 'Currency',
  demo: 'Demo',
}

/**
 * What is left open after a settings button is pressed: the panel it belongs to, or
 * nothing when that panel was already the open one.
 *
 * One modal at a time falls out of holding a single answer rather than four booleans.
 * The backdrop makes it true on screen anyway — the masthead sits behind it, so a second
 * button cannot be reached without dismissing the first — and this makes it true in the
 * state as well, for the ways in that are not a click.
 */
export function toggleSettings(
  open: SettingsPanel | undefined,
  pressed: SettingsPanel,
): SettingsPanel | undefined {
  return open === pressed ? undefined : pressed
}
