import {
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState,
    BaseGameInitializer,
    Game,
    HydratedTurnManager,
    Player,
    Prng,
    shuffle
} from '@tabletop/common'
import { HydratedZertzGameState, ZertzGameState } from '../model/gameState.js'
import { HydratedZertzPlayerState } from '../model/playerState.js'
import { MachineState } from './states.js'
import { ZertzColors } from './colors.js'
import { SETUP_RULES, setupFromConfig } from './config.js'
import { layoutCoordinates } from '../model/layouts.js'
import { noMarbles } from '../model/marbles.js'

export class ZertzGameInitializer
    extends BaseGameInitializer<ZertzGameState, HydratedZertzGameState>
    implements GameInitializer<ZertzGameState, HydratedZertzGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedZertzGameState {
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        turnManager.startTurn(turnManager.turnOrder[0], 0)

        const orderedPlayers = turnManager.turnOrder.map((playerId) => {
            const player = players.find((candidate) => candidate.playerId === playerId)
            if (player === undefined) {
                throw Error(`Missing player ${playerId}`)
            }
            return player
        })

        const setup = setupFromConfig(game.config)
        const rules = SETUP_RULES[setup]

        const zertzGameState: ZertzGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.TakingTurn,
            turnManager,
            setup,
            board: { rings: layoutCoordinates(rules.board).map((coords) => ({ coords })) },
            pool: structuredClone(rules.pool)
        })

        return new HydratedZertzGameState(zertzGameState)
    }

    private initializePlayers(game: Game, prng: Prng): HydratedZertzPlayerState[] {
        const colors = structuredClone(ZertzColors)
        shuffle(colors, prng.random)

        return game.players.map(
            (player: Player, index: number) =>
                new HydratedZertzPlayerState({
                    playerId: player.id,
                    color: colors[index],
                    captured: noMarbles()
                })
        )
    }
}
