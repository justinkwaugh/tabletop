import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { RESOURCES, noResources, type ResourceAmounts } from '../components/resources.js'
import { powerPlant, plantResources } from '../components/plants.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'
import { bestPowerPlan, forcedReturn, plantsOf } from '../model/fuel.js'
import { HydratedScrapPlant } from '../actions/scrapPlant.js'

function act<T extends GameAction>(action: T): GameAction {
    return action
}

export function botAction(
    state: HydratedPowerGridGameState,
    playerId: string,
    step: number
): GameAction {
    const base = { id: `a${step}`, gameId: state.gameId, source: ActionSource.User, playerId }
    const player = state.getPlayerState(playerId)
    switch (state.machineState) {
        case MachineState.PlacingTrust: {
            const targets = state.trustPlacementTargets()
            return act({
                ...base,
                type: ActionType.PlaceTrustHouse,
                cityId: targets[step % targets.length]
            })
        }
        case MachineState.ChoosingPlant: {
            const affordable = state
                .auctionablePlants()
                .filter((plant) => state.canAfford(playerId, state.minimumBid(plant)))
            const capacity = player.plants.reduce((sum, owned) => sum + powerPlant(owned).cities, 0)
            const wantsPlant =
                state.isFirstRound() ||
                (capacity <= state.cityCount(playerId) + 1 && player.money > 25) ||
                (player.plants.length < 2 && step % 2 === 0)
            const plant =
                affordable
                    .filter((candidate) => candidate > player.largestPlant())
                    .at(step % 3 === 0 ? -1 : 0) ?? affordable.at(-1)
            if (!wantsPlant || plant === undefined) {
                return { ...base, type: ActionType.PassAuction }
            }
            return act({
                ...base,
                type: ActionType.ChoosePlant,
                plant,
                bid: state.minimumBid(plant)
            })
        }
        case MachineState.Bidding: {
            const bidding = state.bidding()
            assertExists(bidding, 'Bidding needs an auction')
            const amount = bidding.highBid + 1
            const plant = state.auction?.plant ?? 0
            if (state.canAfford(playerId, amount + 20) && amount < plant + 4 && step % 3 === 0) {
                return act({ ...base, type: ActionType.RaiseBid, amount })
            }
            return { ...base, type: ActionType.PassBid }
        }
        case MachineState.ScrappingPlant: {
            const [plant] = HydratedScrapPlant.scrappablePlants(state, playerId)
            const remaining = HydratedScrapPlant.remainingPlants(state, playerId, plant)
            const returned = forcedReturn(remaining, player.resources)
            return act({ ...base, type: ActionType.ScrapPlant, plant, returned })
        }
        case MachineState.BuyingResources:
            return act({
                ...base,
                type: ActionType.BuyResources,
                resources: shoppingList(state, playerId)
            })
        case MachineState.Building:
            return act({
                ...base,
                type: ActionType.BuildCities,
                cityIds: citiesToBuild(state, playerId)
            })
        case MachineState.Powering: {
            const plan = bestPowerPlan(player.plants, player.resources, state.cityCount(playerId))
            return act({
                ...base,
                type: ActionType.PowerCities,
                plants: plan.plants,
                fuel: plan.fuel
            })
        }
        default:
            throw Error(`The bot cannot act in ${state.machineState}`)
    }
}

function shoppingList(state: HydratedPowerGridGameState, playerId: string): ResourceAmounts {
    const player = state.getPlayerState(playerId)
    const basket = noResources()
    for (const plant of plantsOf(player.plants)) {
        for (let token = 0; token < plant.fuel; token++) {
            const options = plantResources(plant.kind)
            const resource = options.find((option) => {
                const next = { ...basket, [option]: basket[option] + 1 }
                return state.canBuyResources(playerId, next)
            })
            if (resource) {
                basket[resource] += 1
            }
        }
    }
    return RESOURCES.reduce(
        (amounts, resource) => ({ ...amounts, [resource]: basket[resource] }),
        noResources()
    )
}

function citiesToBuild(state: HydratedPowerGridGameState, playerId: string): string[] {
    const player = state.getPlayerState(playerId)
    const capacity = player.plants.reduce((sum, plant) => sum + powerPlant(plant).cities, 0)
    const wanted = Math.max(2, capacity + 2 - state.cityCount(playerId))
    const chosen: string[] = []
    const candidates = [...state.area().cityIds]
    while (chosen.length < Math.min(wanted, 5)) {
        let best: { cityId: string; total: number } | undefined
        for (const cityId of candidates) {
            if (chosen.includes(cityId)) {
                continue
            }
            const quote = state.buildQuote(playerId, [...chosen, cityId])
            if (quote && quote.total <= player.money && (!best || quote.total < best.total)) {
                best = { cityId, total: quote.total }
            }
        }
        if (!best) {
            break
        }
        chosen.push(best.cityId)
    }
    return chosen
}
