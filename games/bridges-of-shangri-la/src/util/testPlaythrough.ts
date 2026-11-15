import {
    ActionSource,
    assert,
    assertExists,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type Game
} from '@tabletop/common'
import { HydratedBeginJourney, type BeginJourney } from '../actions/beginJourney.js'
import type { Pass } from '../actions/pass.js'
import { HydratedPlaceMaster, type PlaceMaster } from '../actions/placeMaster.js'
import { HydratedRecruitStudents, type RecruitStudents } from '../actions/recruitStudents.js'
import type { Placement } from '../components/gameBoard.js'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/gameDefinition.js'
import { BridgesInfo } from '../definition/info.js'
import { MasterType } from '../definition/masterType.js'
import { BridgesRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import type { BridgesGameState, HydratedBridgesGameState } from '../model/gameState.js'

type BridgesAction = PlaceMaster | RecruitStudents | BeginJourney | Pass

export const engine = new GameEngine(BridgesRuntime)
const maxActions = 2000

export function createGame(count: number) {
    return BridgesRuntime.initializer.initializeGame(
        {
            id: 'bridges-competition',
            typeId: BridgesInfo.id,
            ownerId: 'owner',
            seed: 101,
            config: defaultGameConfig(BridgesInfo.configurator?.options ?? []),
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

function placements(state: HydratedBridgesGameState): Placement[] {
    return state.board.villages.flatMap((_, village) =>
        Object.values(MasterType).map((masterType) => ({ masterType, village }))
    )
}

function journey(state: HydratedBridgesGameState, playerId: string) {
    for (const [from, village] of state.board.villages.entries()) {
        if (!HydratedBeginJourney.isValidSourceVillage(state, playerId, from).valid) continue
        const to = village.neighbors.find(
            (neighbor) =>
                HydratedBeginJourney.isValidDestinationVillage(state, neighbor, from).valid
        )
        if (to !== undefined) return { from, to }
    }
    return undefined
}

function recruitment(state: HydratedBridgesGameState, playerId: string) {
    if (state.turnManager.turnCount(playerId) < 7) return undefined
    return placements(state).find(
        (placement) => HydratedRecruitStudents.isValidPlacement(state, playerId, placement).valid
    )
}

function masterPlacement(state: HydratedBridgesGameState, playerId: string) {
    return placements(state).find(
        (placement) => HydratedPlaceMaster.isValidPlacement(state, playerId, placement).valid
    )
}

export function chooseAction(state: HydratedBridgesGameState, index: number): BridgesAction {
    const playerId = state.activePlayerIds[0]
    assertExists(playerId, 'Expected an active player')
    const base = {
        id: `action-${index}`,
        gameId: state.gameId,
        source: ActionSource.User,
        playerId
    }
    const recruit = recruitment(state, playerId)
    if (state.machineState === MachineState.RecruitingStudents) {
        return recruit
            ? { ...base, type: ActionType.RecruitStudents, placement: recruit }
            : { ...base, type: ActionType.Pass }
    }
    const route = state.turnManager.turnCount(playerId) >= 7 ? journey(state, playerId) : undefined
    if (route) return { ...base, type: ActionType.BeginJourney, ...route }
    if (recruit) return { ...base, type: ActionType.RecruitStudents, placement: recruit }
    const placement = masterPlacement(state, playerId)
    if (placement) return { ...base, type: ActionType.PlaceMaster, placement }
    return { ...base, type: ActionType.Pass }
}

export function playToEnd(
    game: Game,
    initialState: BridgesGameState,
    onState: (state: BridgesGameState) => void = () => {}
): BridgesGameState {
    let state = initialState
    onState(state)
    for (let index = 0; state.machineState !== MachineState.EndOfGame; index++) {
        assert(index < maxActions, 'Playthrough did not finish')
        const action = chooseAction(BridgesRuntime.hydrator.hydrateState(state), index)
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
        onState(state)
    }
    return state
}
