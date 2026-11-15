import {
    BaseGameInitializer,
    HydratedTurnManager,
    Prng,
    shuffle,
    type Game,
    type GameInitializer,
    type Point,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import {
    PALACE_COLORS,
    PalaceColor,
    TOWERS,
    boardSize,
    singlePlacementTurns,
    startingStock
} from '../components/pieces.js'
import { HydratedMedinaGameState, type MedinaProjectedState } from '../model/gameState.js'
import { citySpaces } from '../model/geometry.js'
import { HydratedMedinaPlayerState } from '../model/playerState.js'
import { MedinaColors } from './colors.js'
import { hidesPieceCounts, playsWithTeaTiles } from './gameConfig.js'
import { MachineState } from './states.js'

export class MedinaGameInitializer
    extends BaseGameInitializer<MedinaProjectedState, HydratedMedinaGameState>
    implements GameInitializer<MedinaProjectedState, HydratedMedinaGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedMedinaGameState {
        const prng = new Prng(state.prng)
        const playerCount = game.players.length
        const colors = [...MedinaColors]
        shuffle(colors, prng.random)
        const stock = startingStock(playerCount)
        const players = game.players.map(
            (player, index) =>
                new HydratedMedinaPlayerState({
                    playerId: player.id,
                    color: colors[index],
                    buildings: {
                        [PalaceColor.Grey]: stock.buildingsPerColor,
                        [PalaceColor.Purple]: stock.buildingsPerColor,
                        [PalaceColor.Brown]: stock.buildingsPerColor,
                        [PalaceColor.Orange]: stock.buildingsPerColor
                    },
                    rooftops: stock.rooftops,
                    neutralRooftops: stock.neutralRooftops,
                    stables: stock.stables,
                    merchants: stock.merchants,
                    walls: stock.walls,
                    teaTiles: 0,
                    tookTeaBreak: false
                })
        )
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        const inland = this.inlandSpaces(playerCount)
        shuffle(inland, prng.random)
        const [well, firstMerchant] = inland

        const medinaState: MedinaProjectedState = Object.assign(state, {
            players,
            machineState: MachineState.TakingTurn,
            hiddenPieces: hidesPieceCounts(game.config),
            turnManager,
            well,
            palaces: [],
            buildings: [],
            stables: [],
            marketStreets: [[firstMerchant]],
            walls: [],
            palaceTiles: PALACE_COLORS.map((color) => ({ color })),
            towerTiles: TOWERS.map((tower) => ({ tower })),
            singlePlacementTurnsLeft: singlePlacementTurns(playerCount)
        })
        if (!playsWithTeaTiles(game.config)) {
            medinaState.noTeaTiles = true
        }
        return new HydratedMedinaGameState(medinaState)
    }

    private inlandSpaces(playerCount: number): Point[] {
        const size = boardSize(playerCount)
        return citySpaces(size).filter(
            (space) =>
                space.x > 0 && space.y > 0 && space.x < size.width - 1 && space.y < size.height - 1
        )
    }
}
