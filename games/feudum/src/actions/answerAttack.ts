import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { followUpSeat } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { ComponentCount } from '../model/stateSchemas.js'
import { playOutOfTurn, reasonNotInHandRefused } from './cardPlay.js'
import { attackerMayAdd, CombatRecord, resolveCombat, strengthOf } from './combat.js'
import { defendVp } from './playDefend.js'

export type AnswerAttackMetadata = Type.Static<typeof AnswerAttackMetadata>
export const AnswerAttackMetadata = Type.Object({
    /** R-3.14.1 What the flip scored; 0 on "no". */
    vp: ComponentCount,
    /** R-4.8-H5 Present when the attacker could add nothing, so the answer resolved the combat. */
    combat: Type.Optional(CombatRecord)
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
    const attackerId = followUpSeat(state)
    const asIs = strengthOf(state, attackerId, { ...combat, defendFlipped: false }, 0, 0)
    const flipped = strengthOf(state, attackerId, { ...combat, defendFlipped: true }, 0, 0)
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
        const refused = HydratedAnswerAttack.reasonRefused(state, this.playerId, this.flipDefend)
        if (refused) {
            throw Error(refused)
        }
        const vp = this.flipDefend ? HydratedAnswerAttack.scoreDefendFlip(state, this.playerId) : 0
        this.metadata = attackerMayAdd(state, followUpSeat(state))
            ? { vp }
            : { vp, combat: resolveCombat(state, 0, 0) }
    }

    /** R-3.14.1 The defender flips Defend out of turn and scores it. */
    private static scoreDefendFlip(state: HydratedFeudumGameState, playerId: string): number {
        const combat = state.flow.combat
        assertExists(combat, 'R-3.14-H1 An attack is waiting')
        const player = state.getPlayerState(playerId)
        playOutOfTurn(player, 'defend', 'defend-flip')
        const vp = defendVp()
        player.score += vp
        combat.defendFlipped = true
        return vp
    }

    /** R-3.14.1, R-3.14-H1 */
    private static reasonRefused(
        state: HydratedFeudumGameState,
        playerId: string,
        flipDefend: boolean
    ): string | undefined {
        if (state.flow.combat?.defenderId !== playerId) {
            return 'No attack on you is waiting.'
        }
        return flipDefend
            ? reasonNotInHandRefused(state.getPlayerState(playerId), 'defend')
            : undefined
    }
}
