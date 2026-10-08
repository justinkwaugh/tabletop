import {
    BaseGameInitializer,
    HydratedRoundManager,
    HydratedTurnManager,
    Prng,
    assertExists,
    shuffle,
    type Game,
    type GameInitializer,
    type RandomFunction,
    type UninitializedGameState
} from '@tabletop/common'
import { BONUS_CHITS, COPIES_PER_BONUS_CHIT } from '../components/bonusChits.js'
import { CITIES, STARTING_CITY_GOODS } from '../components/cities.js'
import { GOOD_SUPPLY, Good, goodCounts, removeGoods, type GoodCounts } from '../components/goods.js'
import { HydratedRouteMarkerReserve } from '../components/routeMarkerReserve.js'
import { allRouteMarkers, startingHand, withoutMarkers } from '../components/routeMarkers.js'
import type { CityState } from '../model/city.js'
import {
    HydratedKoggeGameState,
    type KoggeGameState,
    type KoggeProjectedState
} from '../model/gameState.js'
import type { KoggePlayerState } from '../model/playerState.js'
import { KoggeColors } from './colors.js'
import { MachineState } from './states.js'

const STARTING_CARGO = goodCounts({ [Good.Ore]: 2, [Good.Fur]: 1 })

export class KoggeGameInitializer
    extends BaseGameInitializer<KoggeProjectedState, HydratedKoggeGameState>
    implements GameInitializer<KoggeProjectedState, HydratedKoggeGameState>
{
    initializeGameState(game: Game, state: UninitializedGameState): HydratedKoggeGameState {
        const prng = new Prng(state.prng)
        assertExists(state.protectedPrng, 'Drawing route markers requires protectedPrng')
        const secretRandom = new Prng(state.protectedPrng).random
        const colors = [...KoggeColors]
        shuffle(colors, prng.random)
        const players: KoggePlayerState[] = game.players.map((player, index) => ({
            playerId: player.id,
            color: colors[index],
            goods: structuredClone(STARTING_CARGO),
            markers: startingHand(),
            markerCount: startingHand().length,
            raidMarkers: 1,
            claimedSecondRaid: false,
            bonusChits: []
        }))
        const reserve = HydratedRouteMarkerReserve.filled(
            withoutMarkers(
                allRouteMarkers(),
                players.flatMap(() => startingHand())
            )
        )
        const routes = this.dealRoutes(reserve, secretRandom)
        const guildMasterCity = this.drawGuildMasterCity(reserve, secretRandom)
        const cities: CityState[] = CITIES.map((city) => ({
            number: city.number,
            goods: goodCounts({ [city.good]: STARTING_CITY_GOODS }),
            offices: [],
            routes: routes[city.number].map((value) => ({ value })),
            raiders: []
        }))

        const koggeState: KoggeGameState = Object.assign(state, {
            players,
            machineState: MachineState.ChoosingStartCities,
            turnManager: HydratedTurnManager.generate(players, prng.random),
            cities,
            supply: this.startingSupply(cities, players.length),
            reserve,
            offer: [],
            bonusSupply: BONUS_CHITS.flatMap((chit) =>
                Array<typeof chit>(COPIES_PER_BONUS_CHIT).fill(chit)
            ),
            guildMaster: { city: guildMasterCity, startCity: guildMasterCity, distance: 0 },
            startChoices: players.map((player) => ({
                playerId: player.playerId,
                submitted: false,
                excluded: []
            })),
            bids: [],
            rounds: HydratedRoundManager.generate(),
            turnIndex: 0
        })
        return new HydratedKoggeGameState(koggeState)
    }

    // Rulebook setup: one marker of each number goes to a city other than its own, then each
    // city draws a second marker that matches neither the city nor its first marker.
    private dealRoutes(reserve: HydratedRouteMarkerReserve, random: RandomFunction): number[][] {
        const firstMarkers = startingHand()
        for (const value of firstMarkers) {
            reserve.takeValue(value)
        }
        do {
            shuffle(firstMarkers, random)
        } while (firstMarkers.some((value, city) => value === city))

        return firstMarkers.map((first, city) => {
            const rejected: number[] = []
            let second = reserve.drawRandom(1, random)[0]
            while (second === city || second === first) {
                rejected.push(second)
                second = reserve.drawRandom(1, random)[0]
            }
            reserve.returnMarkers(rejected)
            return [first, second]
        })
    }

    private drawGuildMasterCity(
        reserve: HydratedRouteMarkerReserve,
        random: RandomFunction
    ): number {
        const [marker] = reserve.drawRandom(1, random)
        reserve.returnMarkers([marker])
        return marker
    }

    private startingSupply(cities: CityState[], playerCount: number): GoodCounts {
        const supply = goodCounts(GOOD_SUPPLY)
        for (const city of cities) {
            removeGoods(supply, city.goods)
        }
        for (let player = 0; player < playerCount; player++) {
            removeGoods(supply, STARTING_CARGO)
        }
        return supply
    }
}
