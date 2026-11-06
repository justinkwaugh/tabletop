import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { ComponentCount } from '../model/stateSchemas.js'
import { reasonNotInHandRefused } from './cardPlay.js'
import { strengthOf } from './combat.js'
import { defendVp } from './playDefend.js'

export type AnswerAttackMetadata = Type.Static<typeof AnswerAttackMetadata>
export const AnswerAttackMetadata = Type.Object({
    /** R-3.14.1 What the flip scored; 0 on "no". */
    vp: ComponentCount
})

export type AnswerAttack = Type.Static<typeof AnswerAttack>
export const AnswerAttack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.AnswerAttack),
            playerId: Type.String(),
            /** R-X.2 The answer depends on a hidden hand, flip or not. */
            revealsInfo: Type.Literal(true),
            /** R-3.14.1 Plays Defend out of turn; `false` is always legal (R-3.14-H1). */
            flipDefend: Type.Boolean(),
            metadata: Type.Optional(AnswerAttackMetadata)
        })
    ])
)

export const AnswerAttackValidator = Compile(AnswerAttack)

export function isAnswerAttack(action?: GameAction): action is AnswerAttack {
    return action?.type === ActionType.AnswerAttack
}

/** R-3.14.1, R-3.14-H1 */
export function reasonAnswerAttackRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    flipDefend: boolean
): string | undefined {
    if (state.flow.combat?.defenderId !== playerId) {
        return 'No attack on you is waiting.'
    }
    return flipDefend ? reasonNotInHandRefused(state.getPlayerState(playerId), 'defend') : undefined
}

/** R-3.14.1 What the prompt shows the defender; another seat gets nothing (S33, S34). */
export interface AnswerAttackOffer {
    readonly holdsDefend: boolean
    /** R-4.8.2 So far: the attacker may yet add. */
    readonly attack: number
    readonly defence: number
    readonly defenceIfFlipped: number
    readonly flipVp: number
    readonly revealsInfo: true
}

/** R-3.14.1, R-5 Reads the asker's own hand and otherwise only what is in view. */
export function answerAttackOffer(
    state: HydratedFeudumGameState,
    playerId: string
): AnswerAttackOffer | undefined {
    const combat = state.flow.combat
    if (combat?.defenderId !== playerId) {
        return undefined
    }
    const asIs = strengthOf(state, { ...combat, defendFlipped: false }, 0, 0)
    const flipped = strengthOf(state, { ...combat, defendFlipped: true }, 0, 0)
    return {
        holdsDefend: state.getPlayerState(playerId).hand?.includes('defend') ?? false,
        attack: asIs.attack.total,
        defence: asIs.defence.total,
        defenceIfFlipped: flipped.defence.total,
        flipVp: defendVp(),
        revealsInfo: true
    }
}

export class HydratedAnswerAttack
    extends HydratableAction<typeof AnswerAttack>
    implements AnswerAttack
{
    declare type: ActionType.AnswerAttack
    declare playerId: string
    declare revealsInfo: true
    declare flipDefend: boolean
    declare metadata?: AnswerAttackMetadata

    constructor(data: AnswerAttack) {
        super(data, AnswerAttackValidator)
    }

    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const refused = reasonAnswerAttackRefused(state, this.playerId, this.flipDefend)
        if (refused) {
            throw Error(refused)
        }
        const combat = state.flow.combat
        assertExists(combat, 'R-3.14-H1 An attack is waiting')
        if (!this.flipDefend) {
            this.metadata = { vp: 0 }
            return
        }
        const player = state.getPlayerState(this.playerId)
        const hand = player.requireHand()
        hand.splice(hand.indexOf('defend'), 1)
        player.handCount = hand.length
        player.played.push({ kind: 'defend', use: 'defend-flip' })
        const vp = defendVp()
        player.score += vp
        combat.defendFlipped = true
        this.metadata = { vp }
    }
}
