import {
    AxialCoordinates,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedPhaseManager,
    HydratedRoundManager,
    HydratedTurnManager,
    PhaseManager,
    PrngState,
    RoundManager
} from '@tabletop/common'
import { KaivaiPlayerState, HydratedKaivaiPlayerState } from './playerState.js'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { KaivaiGameBoard, HydratedKaivaiGameBoard } from '../components/gameBoard.js'

export type KaivaiGameState = Static<typeof KaivaiGameState>
export const KaivaiGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(KaivaiPlayerState),
            machineState: Type.Enum(MachineState),
            rounds: RoundManager,
            phases: PhaseManager,
            board: KaivaiGameBoard,
            influence: Type.Record(Type.String(), Type.Number()),
            bidders: Type.Array(Type.String()),
            bids: Type.Record(Type.String(), Type.Number()),
            cultTiles: Type.Number(),
            godLocation: Type.Optional(
                Type.Object({ coords: AxialCoordinates, islandId: Type.String() })
            ),
            passedPlayers: Type.Array(Type.String()),
            hutsScored: Type.Boolean(),
            islandsToScore: Type.Array(Type.String()),
            chosenIsland: Type.Optional(Type.String())
        })
    ])
)

const KaivaiGameStateValidator = Compile(KaivaiGameState)

export class HydratedKaivaiGameState
    extends HydratableGameState<typeof KaivaiGameState, HydratedKaivaiPlayerState>
    implements KaivaiGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedKaivaiPlayerState[]
    declare turnManager: HydratedTurnManager
    declare rounds: HydratedRoundManager
    declare phases: HydratedPhaseManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: HydratedKaivaiGameBoard
    declare influence: Record<string, number>
    declare bidders: string[]
    declare bids: Record<string, number>
    declare cultTiles: number
    declare godLocation?: { coords: AxialCoordinates; islandId: string }
    declare passedPlayers: string[]
    declare hutsScored: boolean
    declare islandsToScore: string[]
    declare chosenIsland?: string

    constructor(data: KaivaiGameState) {
        super(data, KaivaiGameStateValidator)

        this.rounds = new HydratedRoundManager(data.rounds)
        this.phases = new HydratedPhaseManager(data.phases)
        this.players = data.players.map((player) => new HydratedKaivaiPlayerState(player))
        this.board = new HydratedKaivaiGameBoard(data.board)
    }

    playersOrderedByAscendingWealth(afterDevalue: boolean = false): string[] {
        return this.players
            .sort((a, b) => {
                if (a.score !== b.score) {
                    return a.score - b.score
                }

                const aMoney = afterDevalue ? a.devaluedMoney() : a.money()
                const bMoney = afterDevalue ? b.devaluedMoney() : b.money()

                if (aMoney !== bMoney) {
                    return aMoney - bMoney
                }

                const aFish = afterDevalue ? a.devaluedFish() : a.numFish()
                const bFish = afterDevalue ? b.devaluedFish() : b.numFish()
                if (aFish !== bFish) {
                    return aFish - bFish
                }

                if (
                    Object.values(a.boatLocations).length !== Object.values(b.boatLocations).length
                ) {
                    return (
                        Object.values(a.boatLocations).length -
                        Object.values(b.boatLocations).length
                    )
                }

                // Need to  track huts
                return b.tiles - a.tiles
            })
            .map((player) => player.playerId)
    }
}
