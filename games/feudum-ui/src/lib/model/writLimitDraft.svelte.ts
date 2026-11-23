import type { StagedSelectionState } from '@tabletop/frontend-components'
import {
    DiscardAnyTime,
    DiscardWrit,
    discardWritOffers,
    reasonDiscardWritRefused,
    WritLimit,
    type WritId
} from '@tabletop/feudum'
import type { FlowPlay } from './cardFlows.js'
import type { TurnContext } from './cardModes.js'
import { DeciderDraft, draftChoice, playUnless, type DraftChoice } from './deciderDraft.svelte.js'
import { withLoneChoice } from './stagedDraft.svelte.js'
import type { TurnPrimary } from './turnDraft.svelte.js'
import { writName } from './writLabels.js'

export type WritLimitValues = {
    writ: WritId
}

export const WritLimitStageOrder: readonly (keyof WritLimitValues)[] = ['writ']

export interface WritLimitPanel {
    readonly line: string
    readonly writs: readonly (DraftChoice & { readonly writId: WritId })[]
    readonly primary: TurnPrimary
}

/** R-4.4.4 Over the limit at a turn's end: the discard goes under face down. */
export class WritLimitDraft extends DeciderDraft<WritLimitValues> {
    constructor(contextOf: () => TurnContext | undefined, decisionOf?: () => string | undefined) {
        super(WritLimitStageOrder, contextOf, decisionOf)
    }

    protected override withAutos(
        stored: StagedSelectionState<WritLimitValues>,
        { state, playerId }: TurnContext
    ): StagedSelectionState<WritLimitValues> {
        return withLoneChoice<WritLimitValues, 'writ'>(
            stored,
            WritLimitStageOrder,
            'writ',
            discardWritOffers(state, playerId)
        )
    }

    play: FlowPlay | undefined = $derived.by(() => {
        const context = this.contextOf()
        const writId = this.value('writ')
        return context && writId
            ? playUnless(
                  reasonDiscardWritRefused(context.state, context.playerId, writId),
                  (maker) => maker.createPlayerAction(DiscardWrit, { writId, ...DiscardAnyTime })
              )
            : undefined
    })

    panel: WritLimitPanel | undefined = $derived.by(() => {
        const context = this.contextOf()
        if (!context) {
            return undefined
        }
        const { state, playerId } = context
        const picked = this.value('writ')
        return {
            // R-4.4.4
            line: `Discard ${state.getPlayerState(playerId).writCount - WritLimit}`,
            writs: discardWritOffers(state, playerId).map((writId) => ({
                writId,
                ...draftChoice(writName(writId), writId === picked, () => {
                    if (this.value('writ') === writId) {
                        this.clearFrom('writ')
                    } else {
                        this.set('writ', writId)
                    }
                })
            })),
            primary: {
                label: 'Discard',
                named: "Discard to the deck's bottom · face down",
                enabled: this.play !== undefined
            }
        }
    })
}
