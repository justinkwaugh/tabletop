import { ProvisionalCards } from './provisional.cards.js'
import { ProvisionalGuilds } from './provisional.guilds.js'

export type DataBlockedSpec =
    | 'alchemist.spec.ts'
    | 'charters.spec.ts'
    | 'guildData.spec.ts'
    | 'initializer.spec.ts'
    | 'merchant.spec.ts'
    | 'seals.spec.ts'
    | 'writs.spec.ts'

/** A printed value no source has settled; confirmed after release, it bumps `feudumRevision`. */
export interface ProvisionalEntry<T = unknown> {
    /** The id in `components.md`; `*` stands for every id of the group. */
    readonly componentId: string
    readonly value: string
    readonly placeholder: T
    readonly settledBy: string
    readonly ruling?: string
    readonly dataBlockedIn: readonly DataBlockedSpec[]
}

/** Each entry has its line in `known-deviations.md`, checked by `provisional.spec.ts`. */
export const ProvisionalRegistry: readonly ProvisionalEntry[] = [
    ...Object.values(ProvisionalGuilds),
    ...Object.values(ProvisionalCards)
]
