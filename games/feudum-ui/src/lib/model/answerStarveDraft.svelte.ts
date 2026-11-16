import type { StagedSelectionState } from '@tabletop/frontend-components'
import {
    AnswerStarve,
    answerStarveOffer,
    reasonAnswerStarveRefused,
    type AnswerStarveOffer,
    type Good,
    type TileId
} from '@tabletop/feudum'
import { spaceLabel, type FlowPlay } from './cardFlows.js'
import type { TurnContext } from './cardModes.js'
import { primaryLabel } from './confirmingSend.js'
import {
    costPrimary,
    coverChoices,
    DeciderDraft,
    oneGoodCost,
    playUnless,
    type DraftChoice
} from './deciderDraft.svelte.js'
import { withLoneChoice } from './stagedDraft.svelte.js'
import { coverSpends, loneCover } from './tileCover.js'
import type { TurnPrimary } from './turnDraft.svelte.js'

export type AnswerStarveValues = {
    /** R-3.14-H3 The tile that brings the food. */
    cover: readonly TileId[]
}

export const AnswerStarveStageOrder: readonly (keyof AnswerStarveValues)[] = ['cover']

export interface AnswerStarvePanel {
    readonly line: string
    /** No Defend, no food, or no seal: the seat can only let it go. */
    readonly cantAnswer?: string
    readonly covers?: readonly DraftChoice[]
    readonly immunity?: TurnPrimary
    readonly letGo: { readonly label: string }
}

function needsOf(offer: AnswerStarveOffer): readonly Good[] {
    return offer.holdsDefend && offer.wildTileNeeded ? ['food'] : []
}

/** R-3.14.2 The marker's owner, asked. Nothing here sends: each answer is a press (contract). */
export class AnswerStarveDraft extends DeciderDraft<AnswerStarveValues> {
    constructor(contextOf: () => TurnContext | undefined) {
        super(AnswerStarveStageOrder, contextOf)
    }

    protected override withAutos(
        stored: StagedSelectionState<AnswerStarveValues>,
        { state, playerId }: TurnContext
    ): StagedSelectionState<AnswerStarveValues> {
        const offer = answerStarveOffer(state, playerId)
        const needs = offer ? needsOf(offer) : []
        return withLoneChoice<AnswerStarveValues, 'cover'>(
            stored,
            AnswerStarveStageOrder,
            'cover',
            needs.length > 0 ? loneCover(state, playerId, needs) : []
        )
    }

    /** R-3.14.2 Royal Immunity, or letting it go; the choice is the seat's alone. */
    playOf(royalImmunity: boolean): FlowPlay | undefined {
        const context = this.contextOf()
        const offer = context && answerStarveOffer(context.state, context.playerId)
        if (!context || !offer) {
            return undefined
        }
        const wildTiles = royalImmunity
            ? coverSpends(this.value('cover') ?? [], needsOf(offer))
            : []
        return playUnless(
            reasonAnswerStarveRefused(context.state, context.playerId, royalImmunity, wildTiles),
            (maker) =>
                maker.createPlayerAction(AnswerStarve, {
                    revealsInfo: true,
                    royalImmunity,
                    ...(wildTiles.length > 0 ? { wildTiles } : {})
                }),
            offer
        )
    }

    panel: AnswerStarvePanel | undefined = $derived.by(() => {
        const context = this.contextOf()
        const offer = context && answerStarveOffer(context.state, context.playerId)
        if (!context || !offer) {
            return undefined
        }
        const { state, playerId, nameOf } = context
        const { regionTiles } = state.getPlayerState(playerId)
        const needs = needsOf(offer)
        const cover = this.value('cover') ?? []
        const line = `${nameOf(offer.actorId)} starves your ${offer.role} at ${spaceLabel(offer.spaceId)}.`
        const anyTile = regionTiles.slice(0, needs.length)
        const blocked = reasonAnswerStarveRefused(
            state,
            playerId,
            true,
            coverSpends(anyTile, needs)
        )
        const letGo = { label: primaryLabel('Let it go', offer) }
        if (blocked) {
            return { line, cantAnswer: "You can't answer.", letGo }
        }
        return {
            line,
            ...(needs.length > 0 && regionTiles.length !== needs.length
                ? {
                      covers: coverChoices(state, regionTiles, cover, needs, (after) => {
                          this.push('cover', after)
                      })
                  }
                : {}),
            immunity: costPrimary(
                (cost) => `Royal Immunity · ${cost}`,
                oneGoodCost('food', needs.length > 0, cover),
                this.playOf(true) !== undefined,
                offer
            ),
            letGo
        }
    })
}
