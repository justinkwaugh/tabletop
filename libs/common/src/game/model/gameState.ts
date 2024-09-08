import { TSchema, Type, type Static } from '@sinclair/typebox'
import { TurnManager } from '../components/turnManager.js'
import { Hydratable } from '../../util/hydration.js'
import { calculateChecksum } from '../../util/checksum.js'
import { GameAction } from '../engine/gameAction.js'
import { PlayerState } from './playerState.js'
import { Prng } from '../components/prng.js'

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
    prng: Prng,
    machineState: Type.String(),
    turnManager: TurnManager,
    result: Type.Optional(Type.Enum(GameResult)),
    winningPlayerIds: Type.Array(Type.String())
})

export interface HydratedGameState extends GameState {
    recordAction(action: GameAction): void
    dehydrate(): GameState
}

export abstract class HydratableGameState<T extends TSchema>
    extends Hydratable<T>
    implements HydratedGameState
{
    declare id: string
    declare gameId: string
    declare players: PlayerState[]
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare prng: Prng
    declare machineState: string
    declare turnManager: TurnManager
    declare result?: GameResult
    declare winningPlayerIds: string[]

    recordAction(action: GameAction): void {
        action.index = this.actionCount
        this.actionCount += 1
        this.actionChecksum = calculateChecksum(this.actionChecksum, [action])
    }

    isActivePlayer(playerId: string): boolean {
        return this.activePlayerIds.includes(playerId)
    }
}
