import type { StagedSelectionState } from '@tabletop/frontend-components'
import {
    MachineState,
    type ActionCardKind,
    type HydratedFeudumGameState,
    type PouchGood
} from '@tabletop/feudum'
import { StagedDraft } from './stagedDraft.svelte.js'

export interface DraftedHand {
    readonly cards: readonly ActionCardKind[]
    readonly pouchGood?: PouchGood
}

export type HandDraftValues = {
    /** One stacked stage: a card press keeps the pouch good and a pouch press the cards (S5). */
    hand: DraftedHand
}

export const HandStageOrder = ['hand'] as const satisfies readonly (keyof HandDraftValues)[]
type MissingStages = Exclude<keyof HandDraftValues, (typeof HandStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

const NoHand: DraftedHand = { cards: [] }

/** R-3.1-H1 A hand draft belongs to this round, while the seat has yet to finalise. */
export function handDraftKey(
    state: HydratedFeudumGameState,
    playerId: string | undefined
): string | undefined {
    const { selection } = state.flow
    const round = state.roundManager.currentRound
    if (
        state.machineState !== MachineState.SelectingHands ||
        !selection ||
        !round ||
        !playerId ||
        selection.finalised.includes(playerId)
    ) {
        return undefined
    }
    return `round-${round.number}:${playerId}`
}

/** R-3.1, R-3.3, S4, S9 (contract: Shared visual state) A draft reads back only under its own key. */
export class HandDraft extends StagedDraft<HandDraftValues> {
    private key: string | undefined = $state.raw()

    constructor(private readonly currentKey: () => string | undefined) {
        super(HandStageOrder)
    }

    protected override read(): StagedSelectionState<HandDraftValues> {
        const current = this.currentKey()
        return current !== undefined && this.key === current ? super.read() : {}
    }

    protected override write(stages: StagedSelectionState<HandDraftValues>): void {
        this.key = this.currentKey()
        super.write(stages)
    }

    get hand(): DraftedHand {
        return this.value('hand') ?? NoHand
    }

    toggleCard(kind: ActionCardKind): void {
        const { cards, pouchGood } = this.hand
        const next = cards.includes(kind) ? cards.filter((card) => card !== kind) : [...cards, kind]
        this.push('hand', { cards: next, ...(pouchGood ? { pouchGood } : {}) })
    }

    /** R-3.3 One pouch good; pressing the one already chosen clears it. */
    choosePouch(good: PouchGood): void {
        const { cards, pouchGood } = this.hand
        this.push('hand', { cards, ...(good === pouchGood ? {} : { pouchGood: good }) })
    }
}
