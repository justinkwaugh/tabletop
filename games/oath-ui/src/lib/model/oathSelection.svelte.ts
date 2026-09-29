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

/** R-7.4 — a modifier declared on the staged action, with the choices its text opens. */
export type ModifierDeclaration = { use: PowerUseKey; picks?: PowerChoicePicks }

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

    // Back takes the last modifier declared, one at a time, before the action under it.
    back(): OathStage | undefined {
        const modifiers = this.modifiers
        if (this.highestManualStage() === 'modifiers' && modifiers.length > 1) {
            this.set('modifiers', modifiers.slice(0, -1))
            return 'modifiers'
        }
        return super.back()
    }
}
