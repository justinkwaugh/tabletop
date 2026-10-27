import {
    BaseGameInitializer,
    HydratedPhaseManager,
    HydratedRoundManager,
    HydratedTurnManager,
    Prng,
    assertExists,
    shuffle,
    type Game,
    type GameInitializer,
    type RandomFunction,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { POWER_PLANTS, PlantBack, plantBack } from '../components/plants.js'
import { STARTING_MONEY, Step, playerCountRules } from '../components/rules.js'
import { noResources, type ResourceAmounts } from '../components/resources.js'
import type { GameMap } from '../components/maps/gameMap.js'
import { gameMap } from '../components/maps/maps.js'
import {
    HydratedPowerGridGameState,
    TRUST_HOUSES,
    type PowerGridGameState,
    type PowerGridProjectedState,
    type Trust
} from '../model/gameState.js'
import { HydratedPowerGridPlayerState } from '../model/playerState.js'
import { PlayArea } from '../model/network.js'
import { STEP_3_CARD, sortMarket, type DeckCard } from '../model/plantMarket.js'
import { PowerGridColors } from './colors.js'
import { configuredMap } from './config.js'
import { MachineState } from './states.js'

const MARKET_SIZE = 8

// Recharged p. 2: coal on spaces 1–8, oil 3–8, garbage 6–8, uranium 14–16.
const STARTING_MARKET: ResourceAmounts = { coal: 24, oil: 18, garbage: 9, uranium: 2 }

export type PlantSetup = { market: number[]; deck: DeckCard[] }

/**
 * Recharged p. 2: the market is eight plug plants and one more plug plant waits face down for
 * the top of the stack; some plug and socket plants leave unseen; the rest are shuffled with the
 * Step 3 card underneath.
 */
export function setUpPlants(playerCount: number, random: RandomFunction): PlantSetup {
    const rules = playerCountRules(playerCount)
    const plugs = POWER_PLANTS.filter((plant) => plantBack(plant.number) === PlantBack.Plug).map(
        (plant) => plant.number
    )
    const sockets = POWER_PLANTS.filter(
        (plant) => plantBack(plant.number) === PlantBack.Socket
    ).map((plant) => plant.number)
    shuffle(plugs, random)
    shuffle(sockets, random)
    const market = plugs.splice(0, MARKET_SIZE)
    const [setAside] = plugs.splice(0, 1)
    plugs.splice(0, rules.removedPlugPlants)
    sockets.splice(0, rules.removedSocketPlants)
    const stack = [...plugs, ...sockets]
    shuffle(stack, random)
    return { market: market.toSorted((a, b) => a - b), deck: [setAside, ...stack, STEP_3_CARD] }
}

/** A random group of adjacent regions, grown one neighbouring region at a time. */
export function chooseRegions(map: GameMap, count: number, random: RandomFunction): string[] {
    const adjacent = PlayArea.adjacentRegions(map)
    const ids = map.regions.map((region) => region.id)
    const chosen = [ids[Math.floor(random() * ids.length)]]
    while (chosen.length < count) {
        const frontier = ids.filter(
            (id) => !chosen.includes(id) && chosen.some((picked) => adjacent.get(picked)?.has(id))
        )
        chosen.push(frontier[Math.floor(random() * frontier.length)])
    }
    return chosen
}

export class PowerGridGameInitializer
    extends BaseGameInitializer<PowerGridProjectedState, HydratedPowerGridGameState>
    implements GameInitializer<PowerGridProjectedState, HydratedPowerGridGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedPowerGridGameState {
        const prng = new Prng(state.prng)
        const colors = [...PowerGridColors]
        shuffle(colors, prng.random)
        const joined = game.players.map(
            (player, index) =>
                new HydratedPowerGridPlayerState({
                    playerId: player.id,
                    color: colors[index],
                    money: STARTING_MONEY,
                    plants: [],
                    resources: noResources()
                })
        )
        const turnManager = HydratedTurnManager.generate(joined, prng.random, assignment)
        const seatOrder = [...turnManager.turnOrder]
        const players = seatOrder.map((playerId) => {
            const player = joined.find((candidate) => candidate.playerId === playerId)
            assertExists(player, `No player ${playerId}`)
            return player
        })
        const mapId = configuredMap(game.config)
        const regions = chooseRegions(
            gameMap(mapId),
            playerCountRules(players.length).regions,
            prng.random
        )
        assertExists(state.protectedPrng, 'Shuffling the power plants requires protectedPrng')
        const plants = setUpPlants(players.length, new Prng(state.protectedPrng).random)
        const trust = players.length === 2 ? this.newTrust() : undefined
        const roundManager = HydratedRoundManager.generate()
        roundManager.startRound(0)

        const powerGridState: PowerGridGameState = Object.assign(state, {
            players,
            machineState: trust ? MachineState.PlacingTrust : MachineState.ChoosingPlant,
            turnManager,
            roundManager,
            phaseManager: HydratedPhaseManager.generate(),
            mapId,
            regions,
            seatOrder,
            step: Step.One,
            plantDeck: plants.deck,
            deckCount: plants.deck.length,
            deckTopBack: PlantBack.Plug,
            underStack: [],
            market: sortMarket(plants.market),
            outOfGame: [],
            step3Drawn: false,
            resourceMarket: { ...STARTING_MARKET },
            uraniumPhasedOut: false,
            cities: {},
            phaseDone: [],
            ...(trust ? { trust } : {})
        })
        return new HydratedPowerGridGameState(powerGridState)
    }

    private newTrust(): Trust {
        return {
            plants: [],
            resources: noResources(),
            housesLeft: TRUST_HOUSES,
            startingCities: [],
            tookPlant: false
        }
    }
}
