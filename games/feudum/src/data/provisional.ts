import { ProvisionalCards } from './provisional.cards.js'
import { ProvisionalGuilds } from './provisional.guilds.js'

/** The specs that assert a printed value once it is confirmed. */
export type DataBlockedSpec =
    | 'alchemist.spec.ts'
    | 'charters.spec.ts'
    | 'guildData.spec.ts'
    | 'initializer.spec.ts'
    | 'merchant.spec.ts'
    | 'seals.spec.ts'
    | 'writs.spec.ts'

/**
 * A printed value no source has settled. The data reads `placeholder` from here, so that a
 * confirmed value changes one place: confirming it deletes the entry and its line in
 * `known-deviations.md` in the same change. A value confirmed after release also bumps
 * `feudumRevision` (R-X.3).
 */
export interface ProvisionalEntry<T = unknown> {
    /** The id in `components.md`; `*` stands for every id of the group. */
    readonly componentId: string
    readonly value: string
    readonly placeholder: T
    readonly settledBy: string
    /** The ruling that governs the placeholder, when one does. */
    readonly ruling?: string
    readonly dataBlockedIn: readonly DataBlockedSpec[]
}

/**
 * Every provisional value. An entry is added to the group file for its component, and a line to
 * `known-deviations.md` ("Not covered by specs"); `provisional.spec.ts` checks one against the other.
 */
export const ProvisionalRegistry: readonly ProvisionalEntry[] = [
    ...Object.values(ProvisionalGuilds),
    ...Object.values(ProvisionalCards)
]
