import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { SpaceId } from '../data/board.js'
import { ActionType } from '../definition/actions.js'
import { StarveRole } from '../model/flow.js'
import { followUpSeat } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { canPayGoods, goodsShort, payGoods, WildTileSpend } from '../model/payments.js'
import { moveConcealedSeal } from '../model/seals.js'
import { SpaceIdSchema } from '../model/stateSchemas.js'
import { playOutOfTurn, reasonNotInHandRefused } from './cardPlay.js'
import { ImmunityFood, resolveStarve, StarveRecord } from './starve.js'

export type AnswerStarveMetadata = Type.Static<typeof AnswerStarveMetadata>
export const AnswerStarveMetadata = Type.Object({
    actorId: Type.String(),
    spaceId: SpaceIdSchema,
    role: StarveRole,
    /** R-3.14.2 Royal Immunity was played: the Starve changed nothing. */
    cancelled: Type.Boolean(),
    /** R-3.13.2 Present on "no": the Starve resolved here. */
    starved: Type.Optional(StarveRecord)
})

export type AnswerStarve = Type.Static<typeof AnswerStarve>
export const AnswerStarve = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.AnswerStarve),
            playerId: Type.String(),
            /** R-X.2 The answer depends on a hidden hand, played or not. */
            revealsInfo: Type.Literal(true),
            /** R-3.14.2 Plays Defend's special out of turn; `false` is always legal (R-3.14-H1). */
            royalImmunity: Type.Boolean(),
            /** R-3.14-H3, R-4.4-H1 Turned in first, so they can cover the food. */
            wildTiles: Type.Optional(Type.Array(WildTileSpend)),
            metadata: Type.Optional(AnswerStarveMetadata)
        })
    ])
)

export const AnswerStarveValidator = Compile(AnswerStarve)

export function isAnswerStarve(action?: GameAction): action is AnswerStarve {
    return action?.type === ActionType.AnswerStarve
}

/** R-3.14.2, R-3.14-H1, R-3.14-H3, R-3.14-H4 */
export function reasonAnswerStarveRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    royalImmunity: boolean,
    wildTiles: readonly WildTileSpend[] = []
): string | undefined {
    if (state.flow.starve?.targetPlayerId !== playerId) {
        return 'No Starve the People on you is waiting.'
    }
    // R-4.4-H1 Off its turn a seat spends a tile only where a payment would fall short.
    if (!royalImmunity) {
        return wildTiles.length > 0 ? 'Letting it stand spends no wild tile.' : undefined
    }
    const notInHand = reasonNotInHandRefused(state.getPlayerState(playerId), 'defend')
    if (notInHand) {
        return notInHand
    }
    if (
        wildTiles.length > goodsShort(state, playerId, ImmunityFood).food ||
        wildTiles.some(({ good, sulfurToBarrel }) => good !== 'food' || sulfurToBarrel)
    ) {
        return 'A wild tile may cover only the food Royal Immunity is short of.'
    }
    if (!canPayGoods(state, playerId, ImmunityFood, wildTiles)) {
        return 'Royal Immunity needs a food.'
    }
    return state.supply.sealPileCount > 0 ? undefined : 'No seal is left in the pile.'
}

/** R-3.14.2 What the prompt shows the marker's owner; another seat gets nothing (S38). */
export interface AnswerStarveOffer {
    readonly actorId: string
    readonly spaceId: SpaceId
    readonly role: StarveRole
    readonly holdsDefend: boolean
    /** R-3.14-H3 The seat holds no food, so a wild tile must cover it. */
    readonly wildTileNeeded: boolean
    readonly revealsInfo: true
}

/** R-3.14.2, R-5 Reads the asker's own hand and otherwise only what is in view. */
export function answerStarveOffer(
    state: HydratedFeudumGameState,
    playerId: string
): AnswerStarveOffer | undefined {
    const starve = state.flow.starve
    if (starve?.targetPlayerId !== playerId) {
        return undefined
    }
    return {
        actorId: followUpSeat(state),
        spaceId: starve.spaceId,
        role: starve.role,
        holdsDefend: state.getPlayerState(playerId).hand?.includes('defend') ?? false,
        wildTileNeeded: goodsShort(state, playerId, ImmunityFood).food > 0,
        revealsInfo: true
    }
}

export class HydratedAnswerStarve
    extends HydratableAction<typeof AnswerStarve>
    implements AnswerStarve
{
    declare type: ActionType.AnswerStarve
    declare playerId: string
    declare revealsInfo: true
    declare royalImmunity: boolean
    declare wildTiles?: WildTileSpend[]
    declare metadata?: AnswerStarveMetadata

    constructor(data: AnswerStarve) {
        super(data, AnswerStarveValidator)
    }

    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const refused = reasonAnswerStarveRefused(
            state,
            this.playerId,
            this.royalImmunity,
            this.wildTiles
        )
        if (refused) {
            throw Error(refused)
        }
        const starve = state.flow.starve
        assertExists(starve, 'R-3.14-H1 A Starve is waiting')
        const actorId = followUpSeat(state)
        const { spaceId, role } = starve
        state.flow.starve = undefined
        if (!this.royalImmunity) {
            this.metadata = {
                actorId,
                spaceId,
                role,
                cancelled: false,
                starved: resolveStarve(state, starve)
            }
            return
        }
        // R-3.14.2 Turn in the food, cancel the Starve, and hide a pile seal under the marker.
        playOutOfTurn(state.getPlayerState(this.playerId), 'defend', 'special')
        payGoods(state, this.playerId, ImmunityFood, this.wildTiles)
        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'immunity', spaceId, role })
        this.metadata = { actorId, spaceId, role, cancelled: true }
    }
}
