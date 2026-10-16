import {
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState,
    type AxialCoordinates,
    BaseGameInitializer,
    Color,
    Game,
    HydratedTurnManager,
    Prng
} from '@tabletop/common'
import { HydratedGipfGameState, GipfGameState } from '../model/gameState.js'
import { HydratedGipfPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import { VERSION_RULES, versionFromConfig } from './config.js'
import { emptyBoard, HydratedGipfBoard } from '../model/board.js'

// Alternate corners of the play area, each one push in from an angular dot; dot e1 faces White.
const STARTING_SPOTS: Record<Color.White | Color.Black, AxialCoordinates[]> = {
    [Color.White]: [
        { q: 0, r: 3 },
        { q: -3, r: 0 },
        { q: 3, r: -3 }
    ],
    [Color.Black]: [
        { q: 0, r: -3 },
        { q: -3, r: 3 },
        { q: 3, r: 0 }
    ]
}

export class GipfGameInitializer
    extends BaseGameInitializer<GipfGameState, HydratedGipfGameState>
    implements GameInitializer<GipfGameState, HydratedGipfGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedGipfGameState {
        const prng = new Prng(state.prng)
        const version = versionFromConfig(game.config)
        const rules = VERSION_RULES[version]
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player) => ({ playerId: player.id, color: Color.White })),
            prng.random,
            assignment
        )
        turnManager.startTurn(turnManager.turnOrder[0], 0)

        // The first player plays White.
        const colorOf = (playerId: string) =>
            turnManager.turnOrder[0] === playerId ? Color.White : Color.Black
        const board = new HydratedGipfBoard(emptyBoard())
        const startingCost = rules.hasStartingPosition
            ? STARTING_SPOTS[Color.White].length * (rules.startsWithGipfPieces ? 2 : 1)
            : 0

        const players = turnManager.turnOrder.map((playerId) => {
            const color = colorOf(playerId)
            if (rules.hasStartingPosition && (color === Color.White || color === Color.Black)) {
                for (const coords of STARTING_SPOTS[color]) {
                    board.place(coords, { playerId, gipf: rules.startsWithGipfPieces })
                }
            }
            return new HydratedGipfPlayerState({
                playerId,
                color,
                reserve: rules.pieces - startingCost,
                captured: 0,
                playedSingle: false
            })
        })

        const gipfGameState: GipfGameState = Object.assign(state, {
            players,
            machineState: MachineState.TakingTurn,
            turnManager,
            version,
            board: board.dehydrate(),
            resolvingPlayerIds: []
        })

        return new HydratedGipfGameState(gipfGameState)
    }
}
