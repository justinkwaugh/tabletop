import {
    ActionType,
    Banner,
    type PowerUseKey,
    type Suit,
    type WarbandMoveOption
} from '@tabletop/oath'
import type { StagedSelectionState } from '@tabletop/frontend-components'
import { StagedFlow, type StagesCover } from './stagedFlow.svelte.js'
import type { PowerChoicePicks } from './powerChoices.js'
import type { ConspiracyPick } from './conspiracyTake.js'

/**
 * R-7.4 — a modifier declared on the staged action, with the choices its text opens. `opened`
 * marks the card the powers list opened the action with. `seeded` marks a free gain the action
 * started with in use (Dragonskin Drum, Rowdy Pub …); `down` marks one a tap put down, kept so
 * Undo can bring it back.
 */
export type ModifierDeclaration = {
    use: PowerUseKey
    picks?: PowerChoicePicks
    opened?: true
    seeded?: true
    down?: true
}

// A `type`, not an `interface`: the shared helpers are generic over `Record<string, unknown>`.
export type OathValueByStage = {
    action: ActionType
    siteFavor: Record<string, number>
    modifiers: ModifierDeclaration[]
    warbandMove: WarbandMoveOption
    site: string
    card: string
    discardOrder: string[]
    relicSlot: string
    banner: Banner
    option: string
    toSite: string
    discardFirst: string
    whenPlayed: PowerChoicePicks
    conspiracy: ConspiracyPick
    adviserDiscards: string[]
    amount: number
    favorStart: Suit
}

export const OATH_STAGE_ORDER = [
    'action',
    'siteFavor',
    'modifiers',
    'warbandMove',
    'site',
    'card',
    'discardOrder',
    'relicSlot',
    'banner',
    'option',
    'toSite',
    'discardFirst',
    'whenPlayed',
    'conspiracy',
    'adviserDiscards',
    'amount',
    'favorStart'
] as const

export type OathStage = (typeof OATH_STAGE_ORDER)[number]

const _stagesAreCovered: StagesCover<OathValueByStage, typeof OATH_STAGE_ORDER> = true
void _stagesAreCovered

export type OathSelectionState = StagedSelectionState<OathValueByStage>

/** The action grid's flow: an action, the modifiers declared on it, then what it acts on. */
export class OathSelection extends StagedFlow<OathValueByStage> {
    constructor() {
        super(OATH_STAGE_ORDER)
    }

    get action(): ActionType | undefined {
        return this.value('action')
    }

    get modifiers(): ModifierDeclaration[] {
        return this.value('modifiers') ?? []
    }

    /**
     * Undo takes the last card tapped into use, one at a time, then brings back the free gains a
     * tap put down, before the action under them. The free gains an action starts with are its
     * own (an auto entry), so Undo never takes them alone.
     */
    back(): OathStage | undefined {
        const modifiers = this.modifiers
        if (this.highestManualStage() === 'modifiers') {
            const tapped = modifiers.filter((m) => !m.seeded)
            const last = tapped.at(-1)
            if (last && !last.opened) {
                this.setModifiers(modifiers.filter((m) => m !== last))
                return 'modifiers'
            }
            // The action's own tile may be dimmed, so its last card returns to the powers list.
            if (modifiers.some((m) => m.opened && !m.down)) {
                this.set('action', ActionType.UseActionPower)
                return 'modifiers'
            }
            if (modifiers.some((m) => m.down)) {
                this.setModifiers(modifiers.map(({ use }) => ({ use, seeded: true })))
                return 'modifiers'
            }
        }
        return super.back()
    }

    /** The cards in use: an auto entry while they are the free gains the action started with. */
    setModifiers(modifiers: ModifierDeclaration[]): void {
        const asStarted = modifiers.every((m) => m.seeded && !m.down && !m.opened)
        this.set('modifiers', modifiers, asStarted ? 'auto' : 'manual')
    }
}
