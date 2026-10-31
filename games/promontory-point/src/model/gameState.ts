import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState,
    Visibility,
    assertExists,
    type RandomState
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MAX_PRICE_INDEX, MIN_PRICE_INDEX } from '../components/priceTrack.js'
import type { RailroadId } from '../components/railroads.js'
import type { SpaceId } from '../components/board.js'
import { SHARES_PER_RAILROAD } from '../components/shares.js'
import type { TownTileKindId } from '../components/townTiles.js'
import { TRACK_PIECES_PER_RAILROAD } from '../components/trackPieces.js'
import { MachineState } from '../definition/states.js'
import { invariantsHold } from './invariants.js'
import { PendingRepairs } from './pendingRepairs.js'
import { HydratedPromontoryPointPlayerState, PromontoryPointPlayerState } from './playerState.js'
import { PerRailroad, PerSpace, RailroadIdSchema, TownTileKindIdSchema } from './schemas.js'
import { HydratedTrackBag, TrackBag } from './trackBag.js'
import { TurnState } from './turn.js'

// R-X.3
export const CURRENT_PROMONTORY_POINT_REVISION = 1

export type PromontoryPointGameState = Type.Static<typeof PromontoryPointGameState>
export const PromontoryPointGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(PromontoryPointPlayerState),
    machineState: Type.Enum(MachineState),
    // R-X.3
    promontoryPointRevision: Type.Number(),
    // R-1.3 step 1, R-1.1-H1: face up from setup, one per town.
    towns: PerSpace(TownTileKindIdSchema),
    // R-3.3
    track: PerSpace(RailroadIdSchema),
    // R-1.2, R-1.3 step 3
    priceIndex: PerRailroad(Type.Integer({ minimum: MIN_PRICE_INDEX, maximum: MAX_PRICE_INDEX })),
    // R-1.3 step 6, R-5
    bag: TrackBag,
    // R-3.3, R-3.3-H1: pieces removed from the game.
    scrapped: PerRailroad(Type.Integer({ minimum: 0, maximum: TRACK_PIECES_PER_RAILROAD })),
    turn: Type.Optional(TurnState),
    pendingRepairs: Type.Optional(PendingRepairs)
})

const PromontoryPointGameStateSchemaValidator = Compile(PromontoryPointGameState)

// The strict schema plus the conservation rules a schema cannot state.
export const PromontoryPointGameStateValidator = {
    Check(value: unknown): value is PromontoryPointGameState {
        return PromontoryPointGameStateSchemaValidator.Check(value) && invariantsHold(value)
    }
}

export const PromontoryPointProjectedState =
    Visibility.createProjectionSchema(PromontoryPointGameState)
export type PromontoryPointProjectedState = Type.Static<typeof PromontoryPointProjectedState>
const PromontoryPointProjectedStateValidator = Compile(PromontoryPointProjectedState)

export class HydratedPromontoryPointGameState
    extends HydratableGameState<
        typeof PromontoryPointProjectedState,
        HydratedPromontoryPointPlayerState
    >
    implements PromontoryPointProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare protectedPrng?: RandomState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedPromontoryPointPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare promontoryPointRevision: number
    declare towns: Record<SpaceId, TownTileKindId>
    declare track: Record<SpaceId, RailroadId>
    declare priceIndex: Record<RailroadId, number>
    declare bag: HydratedTrackBag
    declare scrapped: Record<RailroadId, number>
    declare turn?: TurnState
    declare pendingRepairs?: PendingRepairs
    declare result?: GameResult
    declare winningPlayerIds: string[]

    constructor(data: PromontoryPointProjectedState) {
        super(data, PromontoryPointProjectedStateValidator)

        this.players = data.players.map((player) => new HydratedPromontoryPointPlayerState(player))
        this.bag = new HydratedTrackBag(data.bag)
    }

    requireTurn(): TurnState {
        assertExists(this.turn, 'A turn is under way')
        return this.turn
    }

    // R-1.3 step 4: a share deck is 11 less all holdings, never stored.
    shareDeckCount(railroadId: RailroadId): number {
        return (
            SHARES_PER_RAILROAD -
            this.players.reduce((held, player) => held + player.shares[railroadId], 0)
        )
    }
}
