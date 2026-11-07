import type { StagedSelectionState } from '@tabletop/frontend-components'
import {
    ChooseFavours,
    chooseFavoursOffer,
    goodCounts,
    Goods,
    reasonChooseFavoursRefused,
    type Good,
    type GoodCounts
} from '@tabletop/feudum'
import type { FlowPlay } from './cardFlows.js'
import type { TurnContext } from './cardModes.js'
import { DeciderDraft, draftChoice, playUnless, type DraftChoice } from './deciderDraft.svelte.js'
import { withLoneChoice } from './stagedDraft.svelte.js'
import type { TurnPrimary } from './turnDraft.svelte.js'

export type FavoursValues = {
    /** R-3.11.3 Stacked: each press one good, in press order. */
    goods: readonly Good[]
    /** R-4.10.2 How many sulfur taken go straight in the barrel. */
    barrel: number
}

export const FavoursStageOrder: readonly (keyof FavoursValues)[] = ['goods', 'barrel']

export interface FavourRow extends DraftChoice {
    readonly good: Good
    /** How many of this good were drawn. */
    readonly count: number
    /** How many of them are picked. */
    readonly taken: number
}

export interface FavoursPanel {
    readonly line: string
    readonly goods: readonly FavourRow[]
    readonly noFavours: string
    readonly barrel?: readonly DraftChoice[]
    /** R-3.11.2 */
    readonly note?: string
    readonly primary: TurnPrimary
}

function countsOf(goods: readonly Good[]): GoodCounts {
    const counts = goodCounts()
    for (const good of goods) {
        counts[good] += 1
    }
    return counts
}

/** R-3.11.3 One way alone to take them: all that was drawn, or all of a single good. */
function loneFavours(drawn: Readonly<GoodCounts>, favours: number): readonly (readonly Good[])[] {
    const kinds = Goods.filter((good) => drawn[good] > 0)
    const total = kinds.reduce((sum, good) => sum + drawn[good], 0)
    if (kinds.length !== 1 && total !== favours) {
        return []
    }
    return [
        kinds.flatMap((good) => Array.from({ length: Math.min(drawn[good], favours) }, () => good))
    ]
}

/** R-3.11.3 The inspector's favours among the goods in the open. */
export class FavoursDraft extends DeciderDraft<FavoursValues> {
    constructor(contextOf: () => TurnContext | undefined) {
        super(FavoursStageOrder, contextOf)
    }

    protected override withAutos(
        stored: StagedSelectionState<FavoursValues>,
        { state, playerId }: TurnContext
    ): StagedSelectionState<FavoursValues> {
        const offer = chooseFavoursOffer(state, playerId)
        return offer
            ? withLoneChoice<FavoursValues, 'goods'>(
                  stored,
                  FavoursStageOrder,
                  'goods',
                  loneFavours(offer.drawn, offer.favours)
              )
            : stored
    }

    play: FlowPlay | undefined = $derived.by(() => {
        const context = this.contextOf()
        if (!context) {
            return undefined
        }
        const favours = countsOf(this.value('goods') ?? [])
        const barrel = this.value('barrel') ?? 0
        return playUnless(
            reasonChooseFavoursRefused(context.state, context.playerId, favours, barrel),
            (maker) =>
                maker.createPlayerAction(ChooseFavours, {
                    favours,
                    ...(barrel > 0 ? { sulfurToBarrel: barrel } : {})
                })
        )
    })

    private pressGood(good: Good, picks: readonly Good[], taken: number, room: boolean) {
        if (taken < 1 || (room && taken < (this.drawnOf(good) ?? 0))) {
            this.push('goods', [...picks, good])
            return
        }
        const last = picks.lastIndexOf(good)
        this.push('goods', picks.toSpliced(last, 1))
    }

    private drawnOf(good: Good): number | undefined {
        const context = this.contextOf()
        return context && chooseFavoursOffer(context.state, context.playerId)?.drawn[good]
    }

    panel: FavoursPanel | undefined = $derived.by(() => {
        const context = this.contextOf()
        const offer = context && chooseFavoursOffer(context.state, context.playerId)
        if (!offer) {
            return undefined
        }
        const picks = this.value('goods') ?? []
        const room = picks.length < offer.favours
        const sulfurTaken = picks.filter((good) => good === 'sulfur').length
        const mostInBarrel = room ? 0 : Math.min(sulfurTaken, offer.sulfurToBarrel)
        const barrel = this.value('barrel')
        return {
            line: `Take ${offer.favours} as favours`,
            goods: Goods.filter((good) => offer.drawn[good] > 0).map((good) => {
                const count = offer.drawn[good]
                const taken = picks.filter((one) => one === good).length
                return {
                    good,
                    count,
                    taken,
                    ...draftChoice(
                        `${good} ${count}`,
                        taken > 0,
                        () => {
                            this.pressGood(good, picks, taken, room)
                        },
                        taken === 0 && !room
                            ? `You take ${offer.favours}: press a pick to change it.`
                            : undefined
                    )
                }
            }),
            noFavours: 'No favours',
            ...(mostInBarrel > 0
                ? {
                      barrel: Array.from({ length: mostInBarrel + 1 }, (_, count) =>
                          draftChoice(
                              count === 0 ? 'Keep it all' : `${count} into the barrel`,
                              barrel === count,
                              () => {
                                  this.set('barrel', count)
                              }
                          )
                      )
                  }
                : {}),
            ...(offer.beads > 0 ? { note: `Taking them flips ${offer.beads} of your beads` } : {}),
            primary: { label: `Take ${offer.favours}`, enabled: this.play !== undefined }
        }
    })
}
