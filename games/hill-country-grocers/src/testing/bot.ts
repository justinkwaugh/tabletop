import {
    ActionSource,
    MachineContext,
    PlayerStatus,
    type AxialCoordinates,
    type GameAction
} from '@tabletop/common'
import { CompanyId } from '../components/companies.js'
import type { HydratedHcgGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { HcgRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'

export function createGame(count: number) {
    return HcgRuntime.initializer.initializeGame(
        {
            id: 'hcg-playthrough',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 11,
            config: {},
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function act<T extends GameAction>(action: T): GameAction {
    return action
}

export function botAction(state: HydratedHcgGameState, playerId: string, step: number): GameAction {
    const base = { id: `a${step}`, gameId: state.gameId, source: ActionSource.User, playerId }
    const valid = HcgRuntime.stateHandlers[state.machineState].validActionsForPlayer(
        playerId,
        new MachineContext({ gameConfig: {}, gameState: state })
    )
    switch (state.machineState) {
        case MachineState.Bidding: {
            const amount = state.smallestBid()
            const cash = state.getPlayerState(playerId).cash
            if (
                valid.includes(ActionType.PlaceBid) &&
                (!valid.includes(ActionType.PassBid) || amount <= Math.min(cash, 1 + (step % 4)))
            ) {
                return act({ ...base, type: ActionType.PlaceBid, amount })
            }
            return act({ ...base, type: ActionType.PassBid })
        }
        case MachineState.PlacingBonusCube: {
            const [coords] = state.nextCubeHexes(CompanyId.Streamside)
            return step % 3 === 0 || !coords
                ? act({ ...base, type: ActionType.SkipBonusCube })
                : act({
                      ...base,
                      type: ActionType.BuildNetwork,
                      companyId: CompanyId.Streamside,
                      hexes: [coords]
                  })
        }
        case MachineState.ChoosingAction: {
            const spaces = state.availableSpaces(playerId)
            return act({
                ...base,
                type: ActionType.ChooseAction,
                space: spaces[step % spaces.length]
            })
        }
        case MachineState.BuildingNetwork: {
            const [companyId] = state.buildableCompanies(playerId)
            const hexes: AxialCoordinates[] = []
            for (let count = 0; count < 1 + (step % 3); count++) {
                const next = state.nextCubeHexes(companyId, hexes)
                if (next.length === 0) {
                    break
                }
                hexes.push(next[step % next.length])
            }
            return act({ ...base, type: ActionType.BuildNetwork, companyId, hexes })
        }
        case MachineState.DevelopingTowns: {
            if (valid.includes(ActionType.TakeDevelopmentCash) && step % 2 === 0) {
                return act({ ...base, type: ActionType.TakeDevelopmentCash })
            }
            if (!valid.includes(ActionType.Develop)) {
                return act({ ...base, type: ActionType.TakeDevelopmentCash })
            }
            const cities = state.developableCities()
            const cityId = cities[step % cities.length]
            const payeeIds = state.mustChooseBuilderPayees(cityId)
                ? state.grocersInCity(cityId).slice(0, state.builderPaymentsDue(cityId))
                : undefined
            return act({
                ...base,
                type: ActionType.Develop,
                cityId,
                ...(payeeIds ? { payeeIds } : {})
            })
        }
        case MachineState.StartingAuction: {
            const companies = state.auctionableCompanies()
            return act({
                ...base,
                type: ActionType.OpenAuction,
                companyId: companies[step % companies.length],
                amount: Math.min(state.getPlayerState(playerId).cash, step % 3)
            })
        }
        default:
            throw Error(`No bot move in ${state.machineState}`)
    }
}
