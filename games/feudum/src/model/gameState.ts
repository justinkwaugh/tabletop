import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import { FeudumPlayerState, HydratedFeudumPlayerState } from './playerState.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'

export const CURRENT_FEUDUM_REVISION = 1

export type FeudumGameState = Type.Static<typeof FeudumGameState>
export const FeudumGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(FeudumPlayerState),
            machineState: Type.Enum(MachineState),
            feudumRevision: Type.Number()
        })
    ])
)

export const FeudumGameStateValidator = Compile(FeudumGameState)

export class HydratedFeudumGameState
    extends HydratableGameState<typeof FeudumGameState, HydratedFeudumPlayerState>
    implements FeudumGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedFeudumPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare feudumRevision: number
    declare result?: GameResult
    declare winningPlayerIds: string[]

    constructor(data: FeudumGameState) {
        super(data, FeudumGameStateValidator)

        this.players = data.players.map((player) => new HydratedFeudumPlayerState(player))
    }
}
