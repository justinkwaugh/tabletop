import { ActionSource, distanceAxial, type GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { SpaceKind, mapSpace } from '../components/map.js'
import type { RailroadId } from '../components/railroads.js'
import type { HydratedOstbahnGameState } from '../model/gameState.js'
import { directConnections } from '../model/network.js'

function act(
    state: HydratedOstbahnGameState,
    playerId: string,
    fields: Record<string, unknown> & { type: ActionType }
): GameAction {
    return {
        id: `bot-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        playerId,
        ...fields
    }
}

function distanceToStranger(state: HydratedOstbahnGameState, id: RailroadId, spaceId: string) {
    const connected = directConnections(state.railroads, id)
    const targets = state.railroads
        .filter((other) => other.id !== id && !connected.includes(other.id))
        .flatMap((other) => other.track.filter((track) => mapSpace(track).kind === SpaceKind.City))
        .flatMap((track) => mapSpace(track).hexes)
    const from = mapSpace(spaceId).hexes
    return Math.min(
        ...from.flatMap((a) => targets.map((b) => distanceAxial(a, b))),
        Number.MAX_SAFE_INTEGER
    )
}

function bestTrack(state: HydratedOstbahnGameState, id: RailroadId): string | undefined {
    return state
        .buildChoices(id)
        .toSorted((a, b) => distanceToStranger(state, id, a) - distanceToStranger(state, id, b))[0]
}

export function botAction(state: HydratedOstbahnGameState, playerId: string, step: number) {
    switch (state.machineState) {
        case MachineState.ShareBidding: {
            const cash = state.getPlayerState(playerId).cash
            const bid = state.smallestBid()
            const ceiling = Math.max(4, Math.floor(cash / 2)) - (step % 5)
            const wants = bid <= Math.min(cash, ceiling)
            return wants
                ? act(state, playerId, { type: ActionType.PlaceBid, amount: bid })
                : act(state, playerId, { type: ActionType.PassBid })
        }
        case MachineState.ChoosingAction: {
            const expandable = state.expandableRailroads(playerId)
            if (expandable.length > 0 && step % 4 !== 0) {
                const railroadId = expandable[step % expandable.length]
                const spaceId = bestTrack(state, railroadId)
                if (spaceId) {
                    return act(state, playerId, {
                        type: ActionType.BuildTrack,
                        railroadId,
                        spaceId
                    })
                }
            }
            const shares = state.capitalizableRailroads()
            if (shares.length > 0) {
                return act(state, playerId, {
                    type: ActionType.Capitalize,
                    railroadId: shares[step % shares.length]
                })
            }
            return act(state, playerId, { type: ActionType.PassTurn })
        }
        case MachineState.Expanding: {
            const expansion = state.expansion
            if (!expansion) {
                throw Error('The bot is expanding without an Expansion')
            }
            const last = expansion.built.at(-1)
            const arrived =
                last !== undefined && distanceToStranger(state, expansion.railroadId, last) === 0
            const spaceId = bestTrack(state, expansion.railroadId)
            return spaceId && !arrived
                ? act(state, playerId, {
                      type: ActionType.BuildTrack,
                      railroadId: expansion.railroadId,
                      spaceId
                  })
                : act(state, playerId, { type: ActionType.EndExpansion })
        }
        default:
            throw Error(`The bot cannot act in ${state.machineState}`)
    }
}
