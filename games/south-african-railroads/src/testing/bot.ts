import {
    ActionSource,
    MachineContext,
    PlayerStatus,
    assertExists,
    type GameAction
} from '@tabletop/common'
import { MapId } from '../maps/types.js'
import { ActionBox } from '../model/actionBoxes.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { homeLinks } from '../model/track.js'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { SarRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'

export function createGame(count: number, mapId: MapId = MapId.SouthAfrica) {
    return SarRuntime.initializer.initializeGame(
        {
            id: 'sar-playthrough',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 11,
            config: { map: mapId },
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

export function botAction(state: HydratedSarGameState, playerId: string, step: number): GameAction {
    const base = { id: `a${step}`, gameId: state.gameId, source: ActionSource.User, playerId }
    const handler = SarRuntime.stateHandlers[state.machineState]
    const valid = handler.validActionsForPlayer(
        playerId,
        new MachineContext({ gameConfig: {}, gameState: state })
    )
    switch (state.machineState) {
        case MachineState.Bidding: {
            const amount = state.smallestBid()
            const cash = state.getPlayerState(playerId).cash
            if (valid.includes(ActionType.PlaceBid) && amount <= Math.min(cash, 6 + (step % 9))) {
                return act({ ...base, type: ActionType.PlaceBid, amount })
            }
            return act({ ...base, type: ActionType.PassBid })
        }
        case MachineState.FreeBuild: {
            const due = state.freeBuild
            assertExists(due, 'A free build is due')
            const [linkId] = homeLinks(state, state.map.home(due.railroadId))
            return act({
                ...base,
                type: ActionType.BuildTrack,
                railroadId: due.railroadId,
                linkIds: [linkId]
            })
        }
        case MachineState.ChoosingAction: {
            const boxes = state.availableBoxes(playerId)
            const box = boxes[step % boxes.length] ?? ActionBox.ConstructTrack
            return act({ ...base, type: ActionType.ChooseAction, box })
        }
        case MachineState.ConstructingTrack:
        case MachineState.DelegatedBuild: {
            if (valid.includes(ActionType.DelegateBuild)) {
                const [railroadId] = state.buildableRailroads()
                return act({
                    ...base,
                    type: ActionType.DelegateBuild,
                    railroadId,
                    builderId: state.controllers(railroadId)[0]
                })
            }
            const [railroadId] = state.builderRailroads(playerId)
            const [partnerId] = state.specialConnectionPartners(railroadId)
            if (partnerId && step % 2 === 0) {
                return act({
                    ...base,
                    type: ActionType.FoundSpecialConnection,
                    railroadId,
                    partnerId
                })
            }
            const connection = state.connectionBuilds(railroadId)[0]
            if (connection && step % 2 === 0) {
                return act({
                    ...base,
                    type: ActionType.BuildConnection,
                    railroadId,
                    connectionId: connection.id
                })
            }
            const double = state.doubleBuilds(railroadId)[0]
            if (double && step % 3 === 0) {
                return act({
                    ...base,
                    type: ActionType.BuildTrack,
                    railroadId,
                    linkIds: [...double]
                })
            }
            const singles = state.singleBuilds(railroadId)
            return act({
                ...base,
                type: ActionType.BuildTrack,
                railroadId,
                linkIds: [singles[step % singles.length]]
            })
        }
        case MachineState.DevelopingSettlements: {
            const [leaveFrom] = state.leaveTownOptions(playerId)
            if (leaveFrom && (step % 3 === 0 || !valid.includes(ActionType.Develop))) {
                return act({ ...base, type: ActionType.LeaveTown, settlementId: leaveFrom })
            }
            if (valid.includes(ActionType.FinishDevelopment) && step % 2 === 0) {
                return act({ ...base, type: ActionType.FinishDevelopment })
            }
            const options = state.affordableDevelopments(playerId)
            return act({
                ...base,
                type: ActionType.Develop,
                settlementId: options[step % options.length]
            })
        }
        case MachineState.OfferingStock: {
            const [railroadId] = state.unsoldOffers()
            if (railroadId) {
                return act({ ...base, type: ActionType.OfferShare, railroadId, ownShare: false })
            }
            return act({ ...base, type: ActionType.DeclineOffer })
        }
        default:
            throw Error(`No bot move in ${state.machineState}`)
    }
}
