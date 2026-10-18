import {
    BaseGameInitializer,
    HydratedRoundManager,
    HydratedTurnManager,
    Prng,
    assertExists,
    shuffle,
    type Game,
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { edition } from '../editions/editions.js'
import { ACTION_SPACES, INDUSTRIES } from '../editions/types.js'
import {
    HydratedRailheadsGameState,
    type RailheadsGameState,
    type RailheadsProjectedState
} from '../model/gameState.js'
import { HydratedRailheadsPlayerState } from '../model/playerState.js'
import { openInitialAuction } from '../model/shareAuctionRules.js'
import { RailheadsColors } from './colors.js'
import { readRailheadsSetup } from './setup.js'
import { MachineState } from './states.js'

export class RailheadsGameInitializer
    extends BaseGameInitializer<RailheadsProjectedState, HydratedRailheadsGameState>
    implements GameInitializer<RailheadsProjectedState, HydratedRailheadsGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedRailheadsGameState {
        const { editionId, offTheRails } = readRailheadsSetup(game.config)
        const setup = edition(editionId)
        const { definition } = setup
        const prng = new Prng(state.prng)
        const colors = [...RailheadsColors]
        shuffle(colors, prng.random)
        const players = game.players.map(
            (player, index) =>
                new HydratedRailheadsPlayerState({
                    playerId: player.id,
                    color: colors[index],
                    cash: definition.startingCash[game.players.length],
                    industryTokens: []
                })
        )
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        const shareTokens = [...INDUSTRIES]
        shuffle(shareTokens, prng.random)
        const railheadsState: RailheadsGameState = Object.assign(state, {
            players: turnManager.turnOrder.map((playerId) => {
                const player = players.find((candidate) => candidate.playerId === playerId)
                assertExists(player, `No player ${playerId} in the turn order`)
                return player
            }),
            machineState: MachineState.ShareBidding,
            turnManager,
            editionId,
            offTheRails,
            rounds: HydratedRoundManager.generate(),
            companies: definition.companies.map((company) => ({
                id: company.id,
                treasury: company.startingTreasury,
                revenue: definition.siteRevenue[setup.site(company.homeSiteId).kind],
                owners: []
            })),
            track: definition.companies.map((company) => ({
                coords: setup.homeHex(company.id),
                discs: [company.id]
            })),
            industries: INDUSTRIES.map((industry) => ({
                industry,
                level: 1,
                available: definition.industryTokensPerType - 1
            })),
            actionSpaces: ACTION_SPACES.map((id) => ({ id, selections: 0 })),
            roundTimer: 0,
            initialOffers: definition.initialAuctionOrder.map((companyId) => {
                if (companyId === definition.startPlayerCompany) {
                    return { companyId, startPlayer: true }
                }
                const industry = shareTokens.shift()
                assertExists(industry, 'Every opening share but one comes with an industry token')
                return { companyId, industry, startPlayer: false }
            })
        })
        const hydrated = new HydratedRailheadsGameState(railheadsState)
        const [openerId] = turnManager.turnOrder
        openInitialAuction(hydrated, openerId)
        hydrated.activePlayerIds = [openerId]
        return hydrated
    }
}
