import { TSchema, Type, type Static } from '@sinclair/typebox'
import { TurnManager } from '../components/turnManager.js'
import { Hydratable } from '../../util/hydration.js'
import { calculateActionChecksum } from '../../util/checksum.js'
import { GameAction } from '../engine/gameAction.js'
import { PlayerState } from './playerState.js'
import { PrngState } from '../components/prng.js'

export enum GameResult {
    Abandoned = 'Abandoned',
    Draw = 'Draw',
    Win = 'Win'
}

export type GameState = Static<typeof GameState>
export const GameState = Type.Object({
    id: Type.String(),
    gameId: Type.String(),
    players: Type.Array(PlayerState),
    activePlayerIds: Type.Array(Type.String()),
    actionCount: Type.Number(),
    actionChecksum: Type.Number(),
    seed: Type.Optional(Type.Number()), // deprecated
    prng: PrngState,
    machineState: Type.String(),
    turnManager: TurnManager,
    result: Type.Optional(Type.Enum(GameResult)),
    winningPlayerIds: Type.Array(Type.String())
})

export type UninitializedGameState = Omit<GameState, 'players' | 'turnManager' | 'machineState'>

export interface HydratedGameState extends GameState {
    isActivePlayer(playerId: string): boolean
    recordAction(action: GameAction): void
    dehydrate(): GameState
}

export abstract class HydratableGameState<T extends TSchema, U extends PlayerState>
    extends Hydratable<T>
    implements HydratedGameState
{
    declare id: string
    declare gameId: string
    declare players: U[]
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare prng: PrngState
    declare machineState: string
    declare turnManager: TurnManager
    declare result?: GameResult
    declare winningPlayerIds: string[]

    getPlayerState(playerId: string): U {
        const player = this.players.find((player) => player.playerId === playerId)
        if (!player) {
            throw Error(`State for player ${playerId} not found`)
        }
        return player
    }

    recordAction(action: GameAction): void {
        action.index = this.actionCount
        this.actionCount += 1
        this.actionChecksum = calculateActionChecksum(this.actionChecksum, [action])
    }

    isActivePlayer(playerId: string): boolean {
        return this.activePlayerIds.includes(playerId)
    }
}
