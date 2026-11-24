import { ActionSource, PlayerStatus, type GameAction, type GameConfig } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { LwRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import type { HydratedLwGameState } from '../model/gameState.js'
import { locomotiveData } from '../model/locomotives.js'
import type { CapacityPurchase } from '../actions/expandCapacity.js'

export function createGame(count: number, config: GameConfig = {}) {
    return LwRuntime.initializer.initializeGame(
        {
            id: 'lw-playthrough',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 11,
            config,
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

// A simple engineer: develops the newest affordable locomotive, maybe upgrades a unit, then buys capacity on its newest works
// with half its cash, and ships everything it can.
export function botAction(state: HydratedLwGameState, playerId: string, step: number): GameAction {
    const base = { id: `a${step}`, gameId: state.gameId, source: ActionSource.User, playerId }
    const player = state.getPlayerState(playerId)
    switch (state.machineState) {
        case MachineState.Developing: {
            const options = state.developable(playerId)
            const locomotiveId = options.at(-1)
            if (locomotiveId === undefined || step % 5 === 0) {
                return act({ ...base, type: ActionType.PassDevelopment })
            }
            return act({ ...base, type: ActionType.Develop, locomotiveId })
        }
        case MachineState.ExpandingCapacity: {
            const purchases: CapacityPurchase[] = []
            const [oldest] = player.plants
            const newest = player.plants.at(-1)
            let cash = player.cash
            if (
                oldest &&
                newest &&
                step % 3 === 0 &&
                state.canShift(playerId, oldest.locomotiveId, newest.locomotiveId, 1)
            ) {
                purchases.push({
                    locomotiveId: newest.locomotiveId,
                    from: oldest.locomotiveId,
                    units: 1
                })
                cash -= state.shiftCost(oldest.locomotiveId, newest.locomotiveId)
            }
            const budget = Math.floor(cash / 2)
            // An upgraded works may have closed, so buy only where nothing was taken away.
            const target = player.plants.findLast(
                (plant) =>
                    plant.locomotiveId !== purchases[0]?.from &&
                    locomotiveData(plant.locomotiveId).productionCost <= budget
            )
            if (target && step % 4 !== 0) {
                const units = Math.floor(
                    budget / locomotiveData(target.locomotiveId).productionCost
                )
                purchases.push({ locomotiveId: target.locomotiveId, units })
            }
            return act({ ...base, type: ActionType.ExpandCapacity, purchases })
        }
        case MachineState.Shipping: {
            const shipments = state.shipments(playerId)
            const locomotiveIds =
                step % 7 === 0
                    ? shipments.slice(1).map((shipment) => shipment.locomotiveId)
                    : shipments.map((shipment) => shipment.locomotiveId)
            return act({ ...base, type: ActionType.Ship, locomotiveIds })
        }
        default:
            throw Error(`No bot move in ${state.machineState}`)
    }
}
