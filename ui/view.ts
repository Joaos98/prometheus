import { ref, type Ref } from 'vue'

/**
 * Which view the app is showing. The Month dashboard is one subject — a Month — and
 * trends is another: many Months at once, which ADR-0010's three-column layout has no
 * room for and no reason to hold.
 *
 * A ref rather than a router. Prometheus has no URL to speak of, no deep link and no back
 * button of its own, and one boolean in a module is the whole of what a second view needs;
 * a router would be the third runtime dependency for the sake of two values. It is
 * deliberately not remembered across a reload either — where a member left off is the
 * Month they were in, and that is `viewing`'s to answer.
 */
export type View = 'month' | 'trends'

export const showing: Ref<View> = ref('month')

/** Named rather than assigned at each call site, so a view change reads as an act. */
export function show(view: View): void {
  showing.value = view
}
