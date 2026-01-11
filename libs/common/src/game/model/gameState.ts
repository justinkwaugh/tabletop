import { type TSchema, Type, type Static } from 'typebox'
import { HydratedTurnManager, TurnManager } from '../components/turnManager.js'
import { Hydratable } from '../../util/hydration.js'
import { calculateActionChecksum } from '../../util/checksum.js'
import { GameAction } from '../engine/gameAction.js'
import { PlayerState } from './playerState.js'
import { Prng, PrngState } from '../components/prng.js'
import { assertExists } from '../../util/assertions.js'
import { Validator } from 'typebox/compile'

export enum GameResult {
    Abandoned = 'Abandoned',
    Draw = 'Draw',
    Win = 'Win'
}

export type ExplorationState = Static<typeof ExplorationState>
export const ExplorationState = Type.Object({
    actionCount: Type.Number(),
    invocations: Type.Number()
})

export type GameState = Static<typeof GameState>
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
    getPrng(): Prng
    getPlayerState(playerId?: string): P
    findPlayerState(playerId?: string): P | undefined
    isActivePlayer(playerId: string): boolean
    recordAction(action: GameAction): void
    isAtLeastVersion(version: number): boolean
    dehydrate(): T
}

export abstract class HydratableGameState<T extends TSchema, P extends PlayerState>
    extends Hydratable<T>
    implements HydratedGameState<Static<T>, P>
{
    declare systemVersion?: number
    declare id: string
    declare gameId: string
    declare players: P[]
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare prng: PrngState
    declare machineState: string
    declare turnManager: HydratedTurnManager
    declare result?: GameResult
    declare winningPlayerIds: string[]

    constructor(data: Static<T>, validator: Validator<{}, T>) {
        super(data, validator)

        // Hydrate the turn manager
        this.turnManager = new HydratedTurnManager(data.turnManager)
    }

    get numPlayers(): number {
        return this.players.length
    }

    getPrng(): Prng {
        return new Prng(this.prng)
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
