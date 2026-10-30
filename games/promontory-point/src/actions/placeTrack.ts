import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { BOARD_GRID, BoardNodeKind, PROMONTORY, type SpaceId } from '../components/board.js'
import type { RailroadId } from '../components/railroads.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { TownEffectOutcome } from '../effects/townEffectOutcome.js'
import { townEffectAt } from '../effects/townEffects.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { RailroadIdSchema, TownTileKindIdSchema } from '../model/schemas.js'
import type { TurnState } from '../model/turn.js'
import { isOpenTo } from '../rules/network.js'
import { placingHasEnded } from '../rules/placing.js'
import { turnPlayerId } from '../rules/turnPlayer.js'

export enum PlaceTrackRefusal {
    PlacingClosed = 'PlacingClosed',
    RepairsPending = 'RepairsPending',
    NotTurnPlayer = 'NotTurnPlayer',
    PlacementsDone = 'PlacementsDone',
    NotInTurnPieces = 'NotInTurnPieces',
    NotASpace = 'NotASpace',
    Occupied = 'Occupied',
    NotConnected = 'NotConnected'
}

// R-2.2, R-2.2-H1: the first placement opens from trading; the rest follow one another.
const PLACING_STATES: readonly MachineState[] = [
    MachineState.TradingBeforePlacing,
    MachineState.Placing
]

const SpaceKindSchema = Type.Union([
    Type.Literal(BoardNodeKind.Town),
    Type.Literal(BoardNodeKind.Empty),
    Type.Literal(BoardNodeKind.Promontory)
])

const TownEffectIdSchema = Type.Union([TownTileKindIdSchema, Type.Literal(PROMONTORY.spaceId)])

// R-3.3, R-4.2: the space reached and, on a town or Promontory, its event and what it did.
export type PlaceTrackMetadata = Type.Static<typeof PlaceTrackMetadata>
export const PlaceTrackMetadata = Type.Object({
    spaceKind: SpaceKindSchema,
    townEffectId: Type.Optional(TownEffectIdSchema),
    outcome: Type.Optional(TownEffectOutcome)
})

export type PlaceTrack = Type.Static<typeof PlaceTrack>
export const PlaceTrack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceTrack),
            playerId: Type.String(),
            railroadId: RailroadIdSchema,
            // A template literal has no value to create from, so createAction needs a placeholder.
            spaceId: Type.TemplateLiteral('space.${number}.${number}', {
                default: PROMONTORY.spaceId
            }),
            metadata: Type.Optional(PlaceTrackMetadata)
        })
    ])
)

export const PlaceTrackValidator = Compile(PlaceTrack)

export function isPlaceTrack(action?: GameAction): action is PlaceTrack {
    return action?.type === ActionType.PlaceTrack
}

// R-2.2 step 3, R-2.2-H1, R-3.3: a turn piece onto an empty space next to its network.
export function placeTrackRefusal(
    state: HydratedPromontoryPointGameState,
    playerId: string,
    railroadId: RailroadId,
    spaceId: SpaceId
): PlaceTrackRefusal | undefined {
    if (state.machineState === MachineState.PayingRepairs) {
        return PlaceTrackRefusal.RepairsPending
    }
    if (state.machineState === MachineState.TradingAfterPlacing) {
        return PlaceTrackRefusal.PlacementsDone
    }
    if (!PLACING_STATES.includes(state.machineState)) {
        return PlaceTrackRefusal.PlacingClosed
    }
    if (playerId !== turnPlayerId(state)) {
        return PlaceTrackRefusal.NotTurnPlayer
    }
    const turn = placingTurn(state)
    if (placingHasEnded(turn)) {
        return PlaceTrackRefusal.PlacementsDone
    }
    if (!turn.pieces.includes(railroadId)) {
        return PlaceTrackRefusal.NotInTurnPieces
    }
    if (BOARD_GRID.space(spaceId) === undefined) {
        return PlaceTrackRefusal.NotASpace
    }
    if (spaceId in state.track) {
        return PlaceTrackRefusal.Occupied
    }
    if (!isOpenTo(state.track, railroadId, spaceId)) {
        return PlaceTrackRefusal.NotConnected
    }
    return undefined
}

// R-3.3, R-4.2, R-4.3, R-4.3-H1, R-4.3-H4, R-1.2: the piece lands and its space resolves at once.
export class HydratedPlaceTrack extends HydratableAction<typeof PlaceTrack> implements PlaceTrack {
    declare type: ActionType.PlaceTrack
    declare playerId: string
    declare railroadId: RailroadId
    declare spaceId: SpaceId
    declare metadata?: PlaceTrackMetadata

    constructor(data: PlaceTrack) {
        super(data, PlaceTrackValidator)
    }

    apply(state: HydratedPromontoryPointGameState, _context?: MachineContext) {
        const refusal = placeTrackRefusal(state, this.playerId, this.railroadId, this.spaceId)
        if (refusal !== undefined) {
            throw new Error(`PlaceTrack refused: ${refusal}`)
        }
        const turn = placingTurn(state)
        turn.pieces.splice(turn.pieces.indexOf(this.railroadId), 1)
        state.track[this.spaceId] = this.railroadId
        turn.placementsMade += 1
        turn.placementsLeft -= 1

        const { kind: spaceKind } = BOARD_GRID.requireSpace(this.spaceId)
        const effect = townEffectAt(state, this.spaceId)
        if (effect === undefined) {
            // R-3.3: open country resolves nothing.
            this.metadata = { spaceKind }
            return
        }
        const outcome = effect.resolve(state, {
            railroadId: this.railroadId,
            placingPlayerId: this.playerId
        })
        this.metadata = { spaceKind, townEffectId: effect.componentId, outcome }
    }

    static canPlaceTrack(
        state: HydratedPromontoryPointGameState,
        playerId: string,
        railroadId: RailroadId,
        spaceId: SpaceId
    ): boolean {
        return placeTrackRefusal(state, playerId, railroadId, spaceId) === undefined
    }
}

// R-2.2 step 3
function placingTurn(state: HydratedPromontoryPointGameState): TurnState {
    assertExists(state.turn, 'A turn is under way while placing is open')
    return state.turn
}
