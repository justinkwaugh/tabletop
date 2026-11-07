import {
    assertExists,
    BaseGameInitializer,
    HydratedPhaseManager,
    HydratedRoundManager,
    HydratedTurnManager,
    Prng,
    shuffle,
    type Game,
    type GameInitializer,
    type Player,
    type RandomFunction,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import {
    CURRENT_FEUDUM_REVISION,
    HydratedFeudumGameState,
    type FeudumGameState,
    type FeudumProjectedState
} from '../model/gameState.js'
import { Regions } from '../data/board.js'
import { ComponentTotals, StartingSupply } from '../data/components.js'
import { StartingDiscs } from '../data/discs.js'
import {
    AlchemistCartSpaces,
    ChickenSpaces,
    GuildSetupSpaces,
    MarketSpaces,
    MinimumKnightRows
} from '../data/guilds.js'
import { EpochLandscapes, RegionTiles, TileEpochs } from '../data/regionTiles.js'
import { boxContents, placeStartingDiscs } from '../model/boxContents.js'
import { drawGood, drawGoods } from '../model/haversack.js'
import { drawVesselsForSale } from '../model/guildRefill.js'
import { flipSeal, moveConcealedSeal } from '../model/seals.js'
import { payShillingsFromSupply, takeGoodFromHaversack } from '../model/supply.js'
import { emptyPlayerRow, type FeudumPlayerState } from '../model/playerState.js'
import { FeudumColors } from './colors.js'
import { PhaseName } from './phases.js'
import { MachineState } from './states.js'

function shuffled<T>(items: readonly T[], random: RandomFunction): T[] {
    const copy = [...items]
    shuffle(copy, random)
    return copy
}

/** R-1.4.1 The general supply has the markers, food and shillings each seat takes. */
function dealPersonalSupplies(state: HydratedFeudumGameState) {
    for (const player of state.players) {
        player.influenceSupply = StartingSupply.markers
        state.supply.influence[player.color] -= StartingSupply.markers
        player.goods.food = takeGoodFromHaversack(state, 'food', StartingSupply.food)
        payShillingsFromSupply(state, player.playerId, StartingSupply.shillings)
    }
}

/** R-1.4.3 The writs go face down in a shuffled deck; the deck's counts stay as the box left them. */
function shuffleWritDeck(state: HydratedFeudumGameState) {
    const vault = state.requireVault()
    vault.writDeck = shuffled(
        vault.writDeck.map(({ writId }) => writId),
        state.getProtectedPrng().random
    ).map((writId, slot) => ({ slot, writId }))
}

/** R-1.4-H2 Each epoch's six landscapes are shuffled across its tiles, one per region. */
function dealLandscapes(state: HydratedFeudumGameState) {
    const vault = state.requireVault()
    const { random } = state.getProtectedPrng()
    for (const epoch of TileEpochs) {
        const landscapes = shuffled(EpochLandscapes[epoch], random)
        RegionTiles.filter((tile) => tile.epoch === epoch).forEach((tile, index) => {
            vault.tileLandscapes[tile.id] = landscapes[index]
        })
    }
}

/** R-1.4.3 The 22 setup discs, face up; the other 22 are in the general supply already. */
function placeLocationDiscs(state: HydratedFeudumGameState) {
    state.spaces = placeStartingDiscs(shuffled(StartingDiscs, state.getProtectedPrng().random))
}

/** R-1.3 The market and the carts, from the haversack. */
function fillGuildGoods(state: HydratedFeudumGameState) {
    for (const space of MarketSpaces.filter((marketSpace) => marketSpace.filledAtSetup)) {
        takeGoodFromHaversack(state, space.good)
        state.guilds.merchant.market[space.id] = true
    }
    for (const space of AlchemistCartSpaces.filter((cartSpace) => cartSpace.filledAtSetup)) {
        takeGoodFromHaversack(state, space.good)
        state.guilds.alchemist.carts[space.id] = true
    }
}

/** R-1.3, R-1.4-H1 A row per seat, then dummy rows in unused colours; both from the general supply. */
function fillKnightRows(state: HydratedFeudumGameState) {
    const { influence } = state.supply
    const markers = GuildSetupSpaces.knight.markersPerRow
    const dummyColours = FeudumColors.filter(
        (colour) => !state.players.some((player) => player.color === colour)
    ).slice(0, Math.max(MinimumKnightRows - state.numPlayers, 0))

    for (const colour of dummyColours) {
        influence[colour] = ComponentTotals.markersPerColour
    }
    state.guilds.knight.rows = [
        ...state.players.map(({ color, playerId }) => ({ colour: color, playerId, markers })),
        ...dummyColours.map((colour) => ({ colour, markers }))
    ]
    for (const row of state.guilds.knight.rows) {
        influence[row.colour] -= row.markers
    }
}

/** R-1.4.5 Scrolls red side up; rosary and chicken flipped to beads; the rest stay in the pile. */
function dealSeals(state: HydratedFeudumGameState) {
    shuffle(state.requireVault().sealPile, state.getProtectedPrng().random)
    for (const spaceId of GuildSetupSpaces.noble.scrollSpaces) {
        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'scroll', spaceId })
    }
    for (let bead = 0; bead < GuildSetupSpaces.monk.beads; bead += 1) {
        flipSeal(state, { kind: 'pile' }, { kind: 'rosary' })
    }
    ChickenSpaces.forEach((space, index) => {
        if (space.setupBead) {
            flipSeal(state, { kind: 'pile' }, { kind: 'chicken', index })
        }
    })
}

/** R-1.4.5 */
function fillBarn(state: HydratedFeudumGameState) {
    for (const good of drawGoods(state, GuildSetupSpaces.farmer.barnGoods)) {
        state.guilds.farmer.barn[good] += 1
    }
}

/** R-1.4.6 */
function placeRegionGoods(state: HydratedFeudumGameState) {
    for (const region of Regions) {
        const space = region.spaces.find((regionSpace) => regionSpace.letters.includes('N'))
        assertExists(space, `R-1.4.6 ${region.id} has no N space`)
        const good = drawGood(state)
        assertExists(good, 'R-1.4.6 The haversack cannot run out at setup')
        state.spaces[space.id].goods[good] += 1
    }
}

/**
 * R-1.4.1 to R-1.4.6, in the rulebook's order, from the box to the table. Every draw is on the
 * protected stream. The order of the draws is permanent, since a recorded game depends on it.
 */
function layOutTable(state: HydratedFeudumGameState) {
    dealPersonalSupplies(state)
    shuffleWritDeck(state)
    dealLandscapes(state)
    placeLocationDiscs(state)
    fillGuildGoods(state)
    drawVesselsForSale(state, GuildSetupSpaces.alchemist.vessels)
    fillKnightRows(state)
    dealSeals(state)
    fillBarn(state)
    placeRegionGoods(state)
}

export class FeudumGameInitializer
    extends BaseGameInitializer<FeudumProjectedState, HydratedFeudumGameState>
    implements GameInitializer<FeudumProjectedState, HydratedFeudumGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedFeudumGameState {
        const prng = new Prng(state.prng)
        const players = this.initializePlayers(game, prng)
        const turnManager = HydratedTurnManager.generate(players, prng.random, assignment)
        const orderedPlayers = turnManager.turnOrder
            .map((playerId) => players.find((player) => player.playerId === playerId))
            .filter((player): player is FeudumPlayerState => player !== undefined)

        const roundManager = HydratedRoundManager.generate()
        const phaseManager = HydratedPhaseManager.generate()
        phaseManager.startPhase(PhaseName.Setup, state.actionCount)

        const feudumGameState: FeudumGameState = Object.assign(state, {
            players: orderedPlayers,
            machineState: MachineState.ChoosingStartingGoods,
            turnManager,
            roundManager,
            phaseManager,
            feudumRevision: CURRENT_FEUDUM_REVISION,
            ...boxContents(orderedPlayers)
        })

        const hydratedState = new HydratedFeudumGameState(feudumGameState)
        layOutTable(hydratedState)
        return hydratedState
    }

    private initializePlayers(game: Game, prng: Prng): FeudumPlayerState[] {
        const colors = [...FeudumColors]
        shuffle(colors, prng.random)

        return game.players.map((player: Player, index: number) =>
            emptyPlayerRow(player.id, colors[index])
        )
    }
}
