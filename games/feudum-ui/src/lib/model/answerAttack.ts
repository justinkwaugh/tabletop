import { answerAttackOffer, type HydratedFeudumGameState, type PieceRef } from '@tabletop/feudum'
import { spaceLabel } from './cardFlows.js'
import type { TurnContext } from './cardModes.js'
import { primaryLabel } from './confirmingSend.js'

export interface AnswerAttackPanel {
    readonly line: string
    /** R-3.14.1 Only for a seat holding its Defend. */
    readonly flip?: { readonly label: string }
    readonly letStand: { readonly label: string }
}

/** R-3.13.1 What is attacked: a pawn's character, a monster, or the feudum itself. */
export function combatTargetName(
    state: HydratedFeudumGameState,
    target: PieceRef | { readonly kind: 'feudum' }
): string {
    if (target.kind === 'feudum') {
        return 'feudum'
    }
    if (target.kind === 'monster') {
        return target.monsterId
    }
    const pawn = state.getPlayerState(target.playerId).pawns.find(({ n }) => n === target.n)
    return pawn?.character ?? 'pawn'
}

/**
 * R-3.14.1 The defender's two presses, built from the offer. No auto stage and no draft: an answer
 * always waits for its own press, and whether the seat holds Defend reads nowhere else (S34).
 */
export function answerAttackPanelOf({
    state,
    playerId,
    nameOf
}: TurnContext): AnswerAttackPanel | undefined {
    const offer = answerAttackOffer(state, playerId)
    const { combat } = state.flow
    if (!offer || !combat) {
        return undefined
    }
    const name = combatTargetName(state, combat.target)
    const place = spaceLabel(combat.spaceId)
    const gain = offer.defenceIfFlipped - offer.defence
    return {
        line: `${nameOf(combat.attackerId)} conquers your ${name} at ${place}: ${offer.attack} vs ${offer.defence}`,
        // Without Defend the flip is not drawn, and Let it stand is the one press.
        ...(offer.holdsDefend
            ? {
                  flip: {
                      label: primaryLabel(
                          `Flip Defend · +${gain} defence · +${offer.flipVp} vp`,
                          offer
                      )
                  }
              }
            : {}),
        letStand: { label: primaryLabel('Let it stand', offer) }
    }
}
