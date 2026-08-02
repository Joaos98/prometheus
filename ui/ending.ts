/**
 * What to call a row the next Month opened will not inherit.
 *
 * One mark, two honest readings (CONTEXT.md): a row with no past is a **One-Off**, and a
 * row that has been running and stops here **Ends Here**. Kept in one place because all
 * three panels put the same word on the same kind of row, and a Month browsed a year
 * later has to read the same in each.
 */
export const endingTag = (ending: boolean): string => (ending ? 'Ends Here' : 'One-Off')
