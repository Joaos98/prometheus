import { ref, type Ref } from 'vue'

/**
 * What went wrong, as a member should read it. The engine raises DomainError with a
 * sentence already worded for them, so there is nothing to translate — but anything at
 * all can be thrown, and a panel still has to have something to say.
 */
export function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/** What a panel holds while it carries changes out: what went wrong, and how to try. */
export interface Changes {
  /** What the engine or the store said when it last refused a change, if it did. */
  failure: Ref<string | undefined>
  /** Carries a change out, saying so if it is refused, and answering whether it was accepted. */
  report: (change: Promise<void>) => Promise<boolean>
  /**
   * The same, for a change that answers with something — the identity a mint returned, say.
   * What comes back is what the change gave, or nothing at all where it was refused, which
   * is the acceptance `report` answers with as a boolean.
   *
   * Two functions rather than one because the boolean is what almost every caller wants,
   * and `if (!(await report(…))) return` reads as the refusal it is guarding against.
   */
  reporting: <T>(change: Promise<T>) => Promise<T | undefined>
}

/**
 * How every panel carries out a change: the engine and the store are the only judges of
 * whether one is allowed, so a panel's whole job is to say what they said.
 *
 * A change answers whether it was accepted rather than the caller reading it back off
 * `failure`, which any other change in flight is free to have overwritten by the time
 * this one lands. That matters the moment a store awaits real I/O rather than the
 * browser's own storage, and it is what lets a panel close a form on acceptance alone.
 */
export function useChanges(): Changes {
  const failure = ref<string | undefined>(undefined)

  async function reporting<T>(change: Promise<T>): Promise<T | undefined> {
    failure.value = undefined
    try {
      return await change
    } catch (cause) {
      failure.value = messageOf(cause)
      return undefined
    }
  }

  async function report(change: Promise<void>): Promise<boolean> {
    return (await reporting(change.then(() => true))) ?? false
  }

  return { failure, report, reporting }
}
