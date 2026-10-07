import {
    BaseGameInitializer,
    HydratedTurnManager,
    Prng,
    shuffle,
    type Game,
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { COMPANIES, GROCER_IDS } from '../components/companies.js'
import { startingHex } from '../components/map.js'
import { HydratedHcgGameState, type HcgGameState } from '../model/gameState.js'
import { HydratedHcgPlayerState, STARTING_CASH } from '../model/playerState.js'
import { openInitialAuction } from '../model/shareAuctionRules.js'
import { HcgColors } from './colors.js'
import { MachineState } from './states.js'

export class HcgGameInitializer
    extends BaseGameInitializer<HcgGameState, HydratedHcgGameState>
    implements GameInitializer<HcgGameState, HydratedHcgGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedHcgGameState {
        const prng = new Prng(state.prng)
        const colors = [...HcgColors]
        shuffle(colors, prng.random)
        const players = game.players.map(
            (player, index) =>
                new HydratedHcgPlayerState({
                    playerId: player.id,
                    color: colors[index],
                    cash: STARTING_CASH[game.players.length]
                })
        )
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        const initialAuctionOrder = COMPANIES.map((company) => company.id)
        shuffle(initialAuctionOrder, prng.random)
        const hcgState: HcgGameState = Object.assign(state, {
            players: players.toSorted(
                (a, b) =>
                    turnManager.turnOrder.indexOf(a.playerId) -
                    turnManager.turnOrder.indexOf(b.playerId)
            ),
            machineState: MachineState.Bidding,
            turnManager,
            companies: COMPANIES.map((company) => ({
                id: company.id,
                treasury: 0,
                owners: []
            })),
            initialAuctionOrder,
            cubes: GROCER_IDS.map((companyId) => ({ hexId: startingHex(companyId), companyId })),
            developments: {},
            roundTrack: [],
            dividendsPaid: 0,
            turnDevelopments: []
        })
        const hydrated = new HydratedHcgGameState(hcgState)
        const [firstPlayerId] = turnManager.turnOrder
        openInitialAuction(hydrated, initialAuctionOrder[0], firstPlayerId)
        hydrated.activePlayerIds = [firstPlayerId]
        return hydrated
    }
}
