import * as Type from 'typebox'
import { HydratedTurnManager, TurnManager } from '../components/turnManager.js'
import { Hydratable } from '../../util/hydration.js'
import { calculateActionChecksum } from '../../util/checksum.js'
import { GameAction, Patch } from '../engine/gameAction.js'
import { PlayerState } from './playerState.js'
import { Prng, PrngState, ProtectedPrngState, type RandomState } from '../components/prng.js'
import { assertExists } from '../../util/assertions.js'
import { MasterSeed } from '../../util/gameSeeds.js'
import { protect, Policy } from '../visibility/visibilitySchema.js'
import { Validator } from 'typebox/compile'
import { GameResult } from './gameResult.js'

export type ExplorationState = Type.Static<typeof ExplorationState>
export const ExplorationState = Type.Object({
    actionCount: Type.Number(),
    invocations: Type.Number(),
    checkpoint: Type.Optional(
        Type.Object({
            source: Patch,
            hypothetical: Patch,
            undoLimit: Type.Number(),
            canonicalSource: Type.Optional(Type.Literal(true))
        })
    )
})

export type GameState = Type.Static<typeof GameState>
export const GameState = Type.Object({
    systemVersion: Type.Optional(Type.Number()), // Not game specific versioning
    id: Type.String(),
    gameId: Type.String(),
    players: Type.Array(PlayerState),
    activePlayerIds: Type.Array(Type.String()),
    actionCount: Type.Number(),
    actionChecksum: Type.Number(),
    seed: Type.Optional(Type.Number()), // deprecated.. moved to game
    prng: PrngState,
    protectedPrng: Type.Optional(ProtectedPrngState),
    masterSeed: Type.Optional(protect(MasterSeed, { policy: Policy.HostOnly })),
    machineState: Type.String(),
    turnManager: TurnManager,
    result: Type.Optional(Type.Enum(GameResult)),
    winningPlayerIds: Type.Array(Type.String()),
    explorationState: Type.Optional(ExplorationState)
})

export type UninitializedGameState = Omit<GameState, 'players' | 'turnManager' | 'machineState'>

export interface HydratedGameState<
    T extends GameState = GameState,
    P extends PlayerState = PlayerState
> extends GameState {
    players: P[]
    numPlayers: number
    turnManager: HydratedTurnManager
    getPublicPrng(): Prng
    getProtectedPrng(): Prng
    getPlayerState(playerId?: string): P
    findPlayerState(playerId?: string): P | undefined
    isActivePlayer(playerId: string): boolean
    recordAction(action: GameAction): void
    isAtLeastVersion(version: number): boolean
    dehydrate(): T
}

export abstract class HydratableGameState<T extends Type.TSchema, P extends PlayerState>
    extends Hydratable<T>
    implements HydratedGameState<Type.Static<T>, P>
{
    declare systemVersion?: number
    declare id: string
    declare gameId: string
    declare players: P[]
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare prng: PrngState
    declare protectedPrng?: RandomState
    declare masterSeed?: string
    declare machineState: string
    declare turnManager: HydratedTurnManager
    declare result?: GameResult
    declare winningPlayerIds: string[]

    constructor(data: Type.Static<T>, validator: Validator<{}, T>) {
        super(data, validator)

        // Hydrate the turn manager
        this.turnManager = new HydratedTurnManager(data.turnManager)
    }

    get numPlayers(): number {
        return this.players.length
    }

    getPublicPrng(): Prng {
        return new Prng(this.prng)
    }

    getProtectedPrng(): Prng {
        if (!this.isAtLeastVersion(3)) {
            return this.getPublicPrng()
        }
        assertExists(this.protectedPrng, 'Version 3 protected randomness requires protectedPrng')
        return new Prng(this.protectedPrng)
    }

    getPlayerState(playerId?: string): P {
        assertExists(playerId, 'playerId is required to get player state')
        const player = this.findPlayerState(playerId)
        assertExists(player, `Player state for player ${playerId} not found`)
        return player
    }

    findPlayerState(playerId: string): P | undefined {
        return this.players.find((player) => player.playerId === playerId)
    }

    isActivePlayer(playerId: string): boolean {
        return this.activePlayerIds.includes(playerId)
    }

    recordAction(action: GameAction): void {
        action.index = this.actionCount
        this.actionCount += 1
        this.actionChecksum = calculateActionChecksum(this.actionChecksum, [action])
    }

    isAtLeastVersion(version: number): boolean {
        return (this.systemVersion ?? 1) >= version
    }
}
