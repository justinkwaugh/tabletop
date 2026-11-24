import type { StagedSelectionState } from '@tabletop/frontend-components'
import {
    KeepWrits,
    keepWritsOffer,
    reasonKeepWritsRefused,
    type Good,
    type TileId,
    type WritId
} from '@tabletop/feudum'
import type { FlowPlay } from './cardFlows.js'
import type { TurnContext } from './cardModes.js'
import {
    costPrimary,
    coverChoices,
    DeciderDraft,
    draftChoice,
    heldChoice,
    oneGoodCost,
    playUnless,
    type DraftChoice
} from './deciderDraft.svelte.js'
import type { TurnPrimary } from './turnDraft.svelte.js'
import { withLoneChoice } from './stagedDraft.svelte.js'
import { coverSpends, loneCover } from './tileCover.js'
import { writName } from './writLabels.js'

export type KeepWritsValues = {
    /** R-4.4.1 Stacked: each press one pick. */
    keep: readonly WritId[]
    /** R-4.4-H1 */
    cover: readonly TileId[]
}

export const KeepWritsStageOrder: readonly (keyof KeepWritsValues)[] = ['keep', 'cover']

export interface KeepWritsPanel {
    readonly line: string
    readonly writs: readonly (DraftChoice & { readonly writId: WritId })[]
    readonly covers?: readonly DraftChoice[]
    readonly primary: TurnPrimary
    readonly shovels?: TurnPrimary
}

/** R-4.4.1, R-3.10.2 The drawer's keep; its two sends are always a press on a button. */
export class KeepWritsDraft extends DeciderDraft<KeepWritsValues> {
    constructor(contextOf: () => TurnContext | undefined, decisionOf?: () => string | undefined) {
        super(KeepWritsStageOrder, contextOf, decisionOf)
    }

    private needs({ state, playerId }: TurnContext): readonly Good[] {
        return keepWritsOffer(state, playerId)?.shovelsAndSwords?.wildTileNeeded ? ['iron'] : []
    }

    protected override withAutos(
        stored: StagedSelectionState<KeepWritsValues>,
        context: TurnContext
    ): StagedSelectionState<KeepWritsValues> {
        const { state, playerId } = context
        const offer = keepWritsOffer(state, playerId)
        if (!offer) {
            return stored
        }
        const needs = this.needs(context)
        const kept = withLoneChoice<KeepWritsValues, 'keep'>(
            stored,
            KeepWritsStageOrder,
            'keep',
            offer.drawn.length === offer.keep ? [offer.drawn] : []
        )
        return withLoneChoice<KeepWritsValues, 'cover'>(
            kept,
            KeepWritsStageOrder,
            'cover',
            needs.length > 0 ? loneCover(state, playerId, needs) : []
        )
    }

    /** R-4.4.1 The keep alone: the draw's others go under the deck. */
    play: FlowPlay | undefined = $derived.by(() => {
        const context = this.contextOf()
        if (!context) {
            return undefined
        }
        const keep = [...(this.value('keep') ?? [])]
        return playUnless(
            reasonKeepWritsRefused(context.state, context.playerId, { keep }),
            (maker) => maker.createPlayerAction(KeepWrits, { keep })
        )
    })

    /** R-3.10.2 The keep, and the Explore turned in for a second draw. */
    shovelsPlay: FlowPlay | undefined = $derived.by(() => {
        const context = this.contextOf()
        if (!context) {
            return undefined
        }
        const data = {
            keep: [...(this.value('keep') ?? [])],
            shovelsAndSwords: true as const,
            ...this.wildTiles(context)
        }
        return playUnless(
            reasonKeepWritsRefused(context.state, context.playerId, data),
            (maker) => maker.createPlayerAction(KeepWrits, data),
            { revealsInfo: true }
        )
    })

    private wildTiles(context: TurnContext) {
        const cover = this.value('cover') ?? []
        return cover.length > 0 ? { wildTiles: coverSpends(cover, this.needs(context)) } : {}
    }

    panel: KeepWritsPanel | undefined = $derived.by(() => {
        const context = this.contextOf()
        const offer = context && keepWritsOffer(context.state, context.playerId)
        if (!context || !offer) {
            return undefined
        }
        const keep = this.value('keep') ?? []
        const cover = this.value('cover') ?? []
        const needs = this.needs(context)
        const { regionTiles } = context.state.getPlayerState(context.playerId)
        const shovels = offer.shovelsAndSwords
        return {
            line: `Keep ${offer.keep} of ${offer.drawn.length}`,
            writs: offer.drawn.map((writId) => {
                const picked = keep.includes(writId)
                return {
                    writId,
                    ...(!picked && keep.length >= offer.keep
                        ? heldChoice(writName(writId), false)
                        : draftChoice(writName(writId), picked, () => {
                              this.push(
                                  'keep',
                                  picked ? keep.filter((id) => id !== writId) : [...keep, writId]
                              )
                          }))
                }
            }),
            ...(needs.length > 0 && regionTiles.length !== needs.length
                ? {
                      covers: coverChoices(context.state, regionTiles, cover, needs, (after) => {
                          this.push('cover', after)
                      })
                  }
                : {}),
            primary: {
                label: `Keep ${offer.keep} · ${offer.drawn.length - offer.keep} under the deck`,
                enabled: this.play !== undefined
            },
            ...(shovels
                ? {
                      shovels: costPrimary(
                          (cost) =>
                              `Keep, then Shovels & Swords · ${cost} · draw ${shovels.draw} more`,
                          oneGoodCost('iron', needs.length > 0, cover),
                          this.shovelsPlay !== undefined,
                          shovels
                      )
                  }
                : {})
        }
    })
}
