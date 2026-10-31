import {
    GameAction,
    HydratableAction,
    MachineContext,
    Visibility,
    assert,
    assertExists
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { normalizePromontoryPointConfig } from '../definition/config.js'
import { MachineState } from '../definition/states.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { RailroadIdSchema } from '../model/schemas.js'
import { PLACEMENT_STATES, placingHasEnded } from '../rules/placing.js'
import { turnPlayerId } from '../rules/turnPlayer.js'

// R-2.2 step 4
export const END_TURN_DRAW = 3
// R-6.3: the variant's draw after returning the leftover piece, or with none left over.
export const VARIANT_FULL_DRAW = 4

export enum EndTurnRefusal {
    NotEndingTurn = 'NotEndingTurn',
    RepairsPending = 'RepairsPending',
    NotTurnPlayer = 'NotTurnPlayer',
    PlacingUnderWay = 'PlacingUnderWay',
    NotVariant = 'NotVariant',
    NoLeftoverPiece = 'NoLeftoverPiece',
    KeepOrReturnUnchosen = 'KeepOrReturnUnchosen'
}

export enum LeftoverChoice {
    Kept = 'Kept',
    Returned = 'Returned'
}

// R-2.2 step 4, R-5, R-6.3: the drawn pieces to the drawer alone; the count and the choice public.
// R-6.3-H2: the leftover piece's railroad is public too, kept or returned: it lay face up in the
// turn's pieces.
export type EndTurnMetadata = Type.Static<typeof EndTurnMetadata>
export const EndTurnMetadata = Type.Object({
    drawn: Visibility.protect(Type.Array(RailroadIdSchema), {
        policy: Visibility.Policy.Actor
    }),
    drawnCount: Type.Integer({ minimum: 0, maximum: VARIANT_FULL_DRAW }),
    leftover: Type.Optional(Type.Enum(LeftoverChoice)),
    leftoverPiece: Type.Optional(RailroadIdSchema)
})

export type EndTurn = Type.Static<typeof EndTurn>
export const EndTurn = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EndTurn),
            playerId: Type.String(),
            // R-6.3: the variant's choice for a leftover piece; true returns it to the bag.
            returnKeptPiece: Type.Optional(Type.Boolean()),
            metadata: Type.Optional(EndTurnMetadata)
        })
    ])
)

export const EndTurnValidator = Compile(EndTurn)

export function isEndTurn(action?: GameAction): action is EndTurn {
    return action?.type === ActionType.EndTurn
}

// R-2.2 step 4, R-2.2-H1, R-6.3: once placing has ended; the keep-or-return choice in the variant only.
export function endTurnRefusal(
    state: HydratedPromontoryPointGameState,
    playerId: string,
    returnKeptPiece: boolean | undefined,
    fourPieceVariant: boolean
): EndTurnRefusal | undefined {
    if (state.machineState === MachineState.PayingRepairs) {
        return EndTurnRefusal.RepairsPending
    }
    if (PLACEMENT_STATES.includes(state.machineState)) {
        return EndTurnRefusal.PlacingUnderWay
    }
    if (state.machineState !== MachineState.TradingAfterPlacing) {
        return EndTurnRefusal.NotEndingTurn
    }
    if (playerId !== turnPlayerId(state)) {
        return EndTurnRefusal.NotTurnPlayer
    }
    const turn = state.requireTurn()
    if (!placingHasEnded(turn)) {
        return EndTurnRefusal.PlacingUnderWay
    }
    const hasLeftover = turn.pieces.length > 0
    if (returnKeptPiece !== undefined && !fourPieceVariant) {
        return EndTurnRefusal.NotVariant
    }
    if (returnKeptPiece !== undefined && !hasLeftover) {
        return EndTurnRefusal.NoLeftoverPiece
    }
    if (returnKeptPiece === undefined && hasLeftover) {
        return EndTurnRefusal.KeepOrReturnUnchosen
    }
    return undefined
}

// R-2.2 step 4, R-6.3, R-6.3-H2, R-6.1-H2: keep or return the leftover piece, then draw the new hand.
export class HydratedEndTurn extends HydratableAction<typeof EndTurn> implements EndTurn {
    declare type: ActionType.EndTurn
    declare playerId: string
    declare returnKeptPiece?: boolean
    declare metadata?: EndTurnMetadata

    constructor(data: EndTurn) {
        super(data, EndTurnValidator)
    }

    apply(state: HydratedPromontoryPointGameState, context?: MachineContext) {
        assertExists(context, 'EndTurn reads the four-piece variant option from the game config')
        const { fourPieceVariant } = normalizePromontoryPointConfig(context.gameConfig)
        const refusal = endTurnRefusal(state, this.playerId, this.returnKeptPiece, fourPieceVariant)
        if (refusal !== undefined) {
            throw new Error(`EndTurn refused: ${refusal}`)
        }
        const turn = state.requireTurn()
        const player = state.getPlayerState(this.playerId)
        // R-6.3: placing three of four leaves at most one piece over.
        assert(turn.pieces.length <= 1, 'At most one turn piece is left over')
        assert(player.keptPiece === undefined, 'The last kept piece joined this turn at the reveal')
        const leftover = turn.pieces.at(0)

        let leftoverChoice: LeftoverChoice | undefined
        let wanted = fourPieceVariant ? VARIANT_FULL_DRAW : END_TURN_DRAW
        if (leftover !== undefined && this.returnKeptPiece === true) {
            // R-6.3, R-5: the returned piece goes back into the bag, reshuffled unseen.
            state.bag.addItem(leftover)
            state.bag.shuffle(state.getProtectedPrng().random)
            leftoverChoice = LeftoverChoice.Returned
        } else if (leftover !== undefined) {
            // R-6.3-H2: the kept piece stays face up, even one with no open space.
            player.keptPiece = leftover
            wanted = END_TURN_DRAW
            leftoverChoice = LeftoverChoice.Kept
        }

        // R-6.1-H2: a short bag gives what is left.
        const drawnCount = Math.min(wanted, state.bag.count())
        const drawn = drawnCount > 0 ? state.bag.drawItems(drawnCount) : []
        player.hand = drawn
        player.handCount = drawn.length
        delete state.turn

        this.metadata = {
            drawn,
            drawnCount,
            ...(leftoverChoice === undefined || leftover === undefined
                ? {}
                : { leftover: leftoverChoice, leftoverPiece: leftover })
        }
        // R-X.2: the drawer sees the new hand, so this is always an Undo barrier.
        this.revealsInfo = true
    }

    static canEndTurn(
        state: HydratedPromontoryPointGameState,
        playerId: string,
        returnKeptPiece: boolean | undefined,
        fourPieceVariant: boolean
    ): boolean {
        return endTurnRefusal(state, playerId, returnKeptPiece, fourPieceVariant) === undefined
    }
}
