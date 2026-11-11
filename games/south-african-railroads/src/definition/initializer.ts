import {
    BaseGameInitializer,
    assertExists,
    HydratedTurnManager,
    Prng,
    shuffle,
    type Game,
    type GameInitializer,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { sarMap } from '../maps/maps.js'
import type { MapDefinition, RailroadId } from '../maps/types.js'
import { ActionBox } from '../model/actionBoxes.js'
import { AuctionKind } from '../model/auction.js'
import { HydratedSarGameState, type SarGameState } from '../model/gameState.js'
import { HydratedSarPlayerState } from '../model/playerState.js'
import { openShareAuction } from '../model/shareAuctionRules.js'
import { SarColors } from './colors.js'
import { readSarSetup } from './setup.js'
import { MachineState } from './states.js'

function startingTreasury(
    roll: MapDefinition['startingTreasuryRoll'],
    railroadId: RailroadId,
    prng: Prng
): number {
    if (!roll) {
        return 0
    }
    const die = prng.dieRoll(6)
    return roll.doubled.includes(railroadId) ? 2 * die : die
}

export class SarGameInitializer
    extends BaseGameInitializer<SarGameState, HydratedSarGameState>
    implements GameInitializer<SarGameState, HydratedSarGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedSarGameState {
        const { mapId } = readSarSetup(game.config)
        const map = sarMap(mapId)
        const prng = new Prng(state.prng)
        const colors = [...SarColors]
        shuffle(colors, prng.random)
        const players = game.players.map(
            (player, index) =>
                new HydratedSarPlayerState({
                    playerId: player.id,
                    color: colors[index],
                    cash: map.startingCash(game.players.length),
                    locomotive: ActionBox.ConstructTrack,
                    leaveTownCubes: 0
                })
        )
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        const sarState: SarGameState = Object.assign(state, {
            players: turnManager.turnOrder.map((playerId) => {
                const player = players.find((candidate) => candidate.playerId === playerId)
                assertExists(player, `No player ${playerId} in the turn order`)
                return player
            }),
            machineState: MachineState.Bidding,
            mapId,
            turnManager,
            railroads: map.railroads.map((railroad) => ({
                id: railroad.id,
                open: false,
                treasury: startingTreasury(map.definition.startingTreasuryRoll, railroad.id, prng),
                owners: []
            })),
            track: [],
            connections: [],
            developments: {},
            actionTrack: 0,
            dividendsPaid: 0,
            developmentsThisTurn: 0
        })
        const hydrated = new HydratedSarGameState(sarState)
        const [openerId] = turnManager.turnOrder
        openShareAuction(hydrated, {
            kind: AuctionKind.InitialOffering,
            railroadId: map.initialOffering[0],
            openerId,
            minimum: 0
        })
        hydrated.activePlayerIds = [openerId]
        return hydrated
    }
}
