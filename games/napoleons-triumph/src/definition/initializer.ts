import {
    BaseGameInitializer,
    HydratedRoundManager,
    HydratedTurnManager,
    Prng,
    type Game,
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { Side } from '../components/pieces.js'
import {
    HydratedNapoleonsTriumphGameState,
    emptyTurnLimits,
    type NapoleonsTriumphGameState,
    type NapoleonsTriumphProjectedState
} from '../model/gameState.js'
import { HydratedNapoleonsTriumphPlayerState } from '../model/playerState.js'
import { assignSides } from '../model/sides.js'
import { NapoleonsTriumphColors } from './colors.js'
import { SideSelection, santonOf, scenarioOf, sideSelectionOf } from './config.js'
import { MachineState } from './states.js'

export class NapoleonsTriumphGameInitializer
    extends BaseGameInitializer<NapoleonsTriumphProjectedState, HydratedNapoleonsTriumphGameState>
    implements GameInitializer<NapoleonsTriumphProjectedState, HydratedNapoleonsTriumphGameState>
{
    readonly supportsStartingPositions = true

    /** With assigned starting positions the first seat commands the Allies, who move first. */
    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedNapoleonsTriumphGameState {
        const prng = new Prng(state.prng)
        const players = game.players.map(
            (player, index) =>
                new HydratedNapoleonsTriumphPlayerState({
                    playerId: player.id,
                    color: NapoleonsTriumphColors[index],
                    morale: 0,
                    moraleLost: 0,
                    corpsCommandsUsed: 0,
                    independentCommandsUsed: 0,
                    heavyCavalryCommitted: false,
                    guardCommitted: false,
                    guardAttackForfeited: false
                })
        )
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        const auction = sideSelectionOf(game.config) === SideSelection.Auction && !assignment
        const napoleonsTriumphState: NapoleonsTriumphGameState = Object.assign(state, {
            players,
            machineState: auction ? MachineState.Bidding : MachineState.AlliedSetup,
            turnManager,
            rounds: HydratedRoundManager.generate(),
            scenario: scenarioOf(game.config),
            santon: santonOf(game.config),
            round: 0,
            units: [],
            commanders: [],
            frenchReinforcementsEntered: false,
            artilleryFire: {},
            limits: emptyTurnLimits(),
            auction: auction ? {} : undefined
        })
        const hydrated = new HydratedNapoleonsTriumphGameState(napoleonsTriumphState)
        if (!auction) {
            assignSides(hydrated, turnManager.turnOrder[0], Side.Allied)
        }
        return hydrated
    }
}
