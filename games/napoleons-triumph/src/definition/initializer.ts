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
import { openMoraleAuction } from '../model/moraleAuction.js'
import { assignSides } from '../model/sides.js'
import { NapoleonsTriumphColors } from './colors.js'
import { SideSelection, santonOf, scenarioOf, sideSelectionOf } from './config.js'
import { MachineState } from './states.js'

const OPENING_STATE: Record<SideSelection, MachineState> = {
    [SideSelection.Random]: MachineState.AlliedSetup,
    [SideSelection.FirstPlayerChooses]: MachineState.ChoosingSide,
    [SideSelection.Auction]: MachineState.Bidding
}

export class NapoleonsTriumphGameInitializer
    extends BaseGameInitializer<NapoleonsTriumphProjectedState, HydratedNapoleonsTriumphGameState>
    implements GameInitializer<NapoleonsTriumphProjectedState, HydratedNapoleonsTriumphGameState>
{
    readonly supportsStartingPositions = true

    /** Position zero commands the Allies, who move first, unless, with no seats assigned, it chooses an army or the armies are bid for. */
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
                    guardAttackForfeited: false,
                    artilleryFire: {}
                })
        )
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        // House ruling: at a table with assigned seats (a tournament) the seat decides the army, never a choice.
        const sideSelection =
            assignment === undefined ? sideSelectionOf(game.config) : SideSelection.Random
        const auction = sideSelection === SideSelection.Auction
        const napoleonsTriumphState: NapoleonsTriumphGameState = Object.assign(state, {
            players,
            machineState: OPENING_STATE[sideSelection],
            turnManager,
            rounds: HydratedRoundManager.generate(),
            scenario: scenarioOf(game.config),
            santon: santonOf(game.config),
            units: [],
            commanders: [],
            frenchReinforcementsEntered: false,
            limits: emptyTurnLimits(),
            auction: auction ? openMoraleAuction(turnManager.turnOrder) : undefined
        })
        const hydrated = new HydratedNapoleonsTriumphGameState(napoleonsTriumphState)
        if (sideSelection === SideSelection.Random) {
            assignSides(hydrated, turnManager.turnOrder[0], Side.Allied)
        }
        return hydrated
    }
}
