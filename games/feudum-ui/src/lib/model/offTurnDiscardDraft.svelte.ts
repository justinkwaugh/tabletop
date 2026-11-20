import {
    DiscardAnyTime,
    DiscardWrit,
    discardWritOffers,
    reasonDiscardWritRefused,
    type HydratedFeudumGameState,
    type WritId
} from '@tabletop/feudum'
import type { FlowPlay } from './cardFlows.js'
import { sendsOnPress } from './confirmingSend.js'
import { DeciderDraft, draftChoice, playUnless, type DraftChoice } from './deciderDraft.svelte.js'
import { writName } from './writLabels.js'

export type OffTurnDiscardValues = {
    seat: string
    /** R-4.4.4 */
    writ: WritId
}

export const OffTurnDiscardStageOrder: readonly (keyof OffTurnDiscardValues)[] = ['seat', 'writ']

export interface OffTurnDiscardContext {
    readonly state: HydratedFeudumGameState
    readonly seats: readonly string[]
    readonly nameOf: (playerId: string) => string
}

export interface OffTurnDiscardPanel {
    readonly chips: readonly (DraftChoice & { readonly seat: string })[]
    readonly writs?: readonly {
        readonly writId: WritId
        readonly name: string
        readonly choices: readonly DraftChoice[]
    }[]
}

/** R-4.4-H5 A writ is discarded at any time, so each other seat holding one has a chip. */
export class OffTurnDiscardDraft extends DeciderDraft<OffTurnDiscardValues, OffTurnDiscardContext> {
    constructor(contextOf: () => OffTurnDiscardContext | undefined) {
        super(OffTurnDiscardStageOrder, contextOf)
    }

    private openSeat(context: OffTurnDiscardContext): string | undefined {
        const seat = this.value('seat')
        return seat && context.seats.includes(seat) ? seat : undefined
    }

    private play: FlowPlay | undefined = $derived.by(() => {
        const context = this.contextOf()
        const seat = context && this.openSeat(context)
        const writId = this.value('writ')
        return context && seat && writId
            ? playUnless(reasonDiscardWritRefused(context.state, seat, writId), (maker) => ({
                  ...maker.createPlayerAction(DiscardWrit, { writId, ...DiscardAnyTime }),
                  playerId: seat
              }))
            : undefined
    })

    sendsNow: FlowPlay | undefined = $derived.by(() =>
        this.play && sendsOnPress(this, this.play) ? this.play : undefined
    )

    panel: OffTurnDiscardPanel | undefined = $derived.by(() => {
        const context = this.contextOf()
        if (!context || context.seats.length === 0) {
            return undefined
        }
        const open = this.openSeat(context)
        return {
            chips: context.seats.map((seat) => ({
                seat,
                ...draftChoice(`${context.nameOf(seat)}'s writs`, seat === open, () => {
                    if (this.value('seat') === seat) {
                        this.clearFrom('seat')
                    } else {
                        this.set('seat', seat)
                    }
                })
            })),
            ...(open
                ? {
                      writs: discardWritOffers(context.state, open).map((writId) => ({
                          writId,
                          name: writName(writId),
                          choices: [
                              draftChoice('Discard', this.value('writ') === writId, () => {
                                  this.set('writ', writId)
                              })
                          ]
                      }))
                  }
                : {})
        }
    })
}
