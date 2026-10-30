import { ActionSource, assertExists, GameEngine, PlayerStatus, type Game } from '@tabletop/common'
import {
    HydratedChooseOperatingCompany,
    type ChooseOperatingCompany
} from '../actions/chooseOperatingCompany.js'
import type { DeliverGood } from '../actions/deliverGood.js'
import type { Expand } from '../actions/expand.js'
import type { GrowCity } from '../actions/growCity.js'
import { HydratedPass, PassReason, type Pass } from '../actions/pass.js'
import type { PassMergerBid } from '../actions/passMergerBid.js'
import type { PlaceMergerBid } from '../actions/placeMergerBid.js'
import { HydratedProposeMerger, type ProposeMerger } from '../actions/proposeMerger.js'
import type { RemoveSiapSajiArea } from '../actions/removeSiapSajiArea.js'
import { HydratedPlaceCity, type PlaceCity } from '../actions/placeCity.js'
import type { PlaceTurnOrderBid } from '../actions/placeTurnOrderBid.js'
import type { Research } from '../actions/research.js'
import { HydratedStartCompany, type StartCompany } from '../actions/startCompany.js'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { IndonesiaInfo } from '../definition/info.js'
import { IndonesiaRuntime } from '../definition/runtime.js'
import { ResearchArea } from '../definition/researchAreas.js'
import { MachineState } from '../definition/states.js'
import type { HydratedIndonesiaGameState, IndonesiaGameState } from '../model/gameState.js'
import { listSafeAtomicDeliveryCandidatesForPlayer } from '../operations/deliveryCandidates.js'
import { validSiapSajiRemovalAreaIds } from '../operations/mergers.js'

export const engine = new GameEngine(IndonesiaRuntime)

export function createGame(count: number) {
    return IndonesiaRuntime.initializer.initializeGame(
        {
            id: 'indonesia-competition',
            typeId: IndonesiaInfo.id,
            ownerId: 'owner',
            seed: 101,
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

export function placeNewEraCities(game: Game, initialState: IndonesiaGameState) {
    let state = initialState
    while (state.machineState === MachineState.NewEra) {
        const [playerId] = state.activePlayerIds
        assertExists(playerId, 'Expected an active player placing a city')
        const hydrated = IndonesiaRuntime.hydrator.hydrateState(state)
        const [areaId] = HydratedPlaceCity.validAreaIds(hydrated, playerId)
        assertExists(areaId, `Expected a city placement for ${playerId}`)
        const action: PlaceCity = {
            id: `city-${playerId}`,
            gameId: game.id,
            source: ActionSource.User,
            type: ActionType.PlaceCity,
            playerId,
            areaId
        }
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
    }
    return state
}

const researchPriority = [
    ResearchArea.slots,
    ResearchArea.expansion,
    ResearchArea.hull,
    ResearchArea.mergers,
    ResearchArea.bid
]

type BotAction =
    | PlaceCity
    | PlaceTurnOrderBid
    | StartCompany
    | Research
    | ChooseOperatingCompany
    | GrowCity
    | ProposeMerger
    | PlaceMergerBid
    | PassMergerBid
    | RemoveSiapSajiArea
    | Pass
    | DeliverGood
    | Expand

function isAtCompanyLimit(state: HydratedIndonesiaGameState, playerId: string): boolean {
    const player = state.getPlayerState(playerId)
    return player.ownedCompanies.length >= 1 + player.research.slots
}

export function nextBotAction(game: Game, state: IndonesiaGameState): BotAction {
    const [playerId] = state.activePlayerIds
    assertExists(playerId, `Expected an active player in ${state.machineState}`)
    const types = engine.getValidActionTypesForPlayer(game, state, playerId)
    const hydrated = IndonesiaRuntime.hydrator.hydrateState(state)
    const base = {
        id: `bot-${state.actionCount}`,
        gameId: game.id,
        source: ActionSource.User,
        playerId
    }

    if (types.includes(ActionType.PlaceCity)) {
        const [areaId] = HydratedPlaceCity.validAreaIds(hydrated, playerId)
        assertExists(areaId, `Expected a city placement for ${playerId}`)
        return { ...base, type: ActionType.PlaceCity, areaId }
    }
    if (types.includes(ActionType.PlaceTurnOrderBid)) {
        return { ...base, type: ActionType.PlaceTurnOrderBid, amount: 0 }
    }
    if (types.includes(ActionType.StartCompany)) {
        const startable = hydrated.availableDeeds.find((deed) =>
            HydratedStartCompany.canDeedBeStarted(hydrated, deed.id)
        )
        assertExists(startable, `Expected a startable deed for ${playerId}`)
        const [areaId] = HydratedStartCompany.validAreaIds(hydrated, playerId, startable.id)
        assertExists(areaId, `Expected an area to start ${startable.id}`)
        return { ...base, type: ActionType.StartCompany, deedId: startable.id, areaId }
    }
    if (types.includes(ActionType.Research)) {
        const levels = hydrated.getPlayerState(playerId).research
        const researchArea = researchPriority.find((area) => levels[area] < 4)
        assertExists(researchArea, `Expected research left for ${playerId}`)
        return { ...base, type: ActionType.Research, targetPlayerId: playerId, researchArea }
    }
    if (types.includes(ActionType.ChooseOperatingCompany)) {
        const company = hydrated.companies.find((candidate) =>
            HydratedChooseOperatingCompany.canChooseSpecificCompany(
                hydrated,
                playerId,
                candidate.id
            )
        )
        assertExists(company, `Expected an operable company for ${playerId}`)
        return { ...base, type: ActionType.ChooseOperatingCompany, companyId: company.id }
    }
    if (types.includes(ActionType.GrowCity)) {
        const [cityId] = hydrated.cityGrowthEligibleCityIds()
        assertExists(cityId, 'Expected a city to grow')
        return { ...base, type: ActionType.GrowCity, cityId }
    }
    if (types.includes(ActionType.ProposeMerger) && isAtCompanyLimit(hydrated, playerId)) {
        const [option] = HydratedProposeMerger.listProposableMergers(hydrated, playerId)
        assertExists(option, `Expected a merger option for ${playerId}`)
        return {
            ...base,
            type: ActionType.ProposeMerger,
            companyAId: option.companyAId,
            companyBId: option.companyBId
        }
    }
    const auction = hydrated.activeMergerAuction
    const proposal = hydrated.activeMergerProposal
    if (types.includes(ActionType.PlaceMergerBid) && proposal && auction?.highBid === undefined) {
        return { ...base, type: ActionType.PlaceMergerBid, amount: proposal.nominalValue }
    }
    if (types.includes(ActionType.PassMergerBid)) {
        return { ...base, type: ActionType.PassMergerBid }
    }
    if (types.includes(ActionType.RemoveSiapSajiArea)) {
        const reduction = hydrated.pendingSiapSajiReduction
        assertExists(reduction, 'Expected a pending siap saji reduction')
        const [areaId] = validSiapSajiRemovalAreaIds(hydrated, reduction.companyId)
        assertExists(areaId, `Expected a siap saji area to remove from ${reduction.companyId}`)
        return { ...base, type: ActionType.RemoveSiapSajiArea, areaId }
    }
    const passReason = Object.values(PassReason).find((reason) =>
        HydratedPass.canPass(hydrated, playerId, reason)
    )
    if (types.includes(ActionType.Pass) && passReason) {
        return { ...base, type: ActionType.Pass, reason: passReason }
    }
    if (types.includes(ActionType.DeliverGood)) {
        const [candidate] = listSafeAtomicDeliveryCandidatesForPlayer(hydrated, playerId)
        assertExists(candidate, `Expected a delivery for ${playerId}`)
        return {
            ...base,
            type: ActionType.DeliverGood,
            cultivatedAreaId: candidate.cultivatedAreaId,
            shippingCompanyId: candidate.shippingCompanyId,
            seaAreaIds: candidate.seaAreaIds,
            cityId: candidate.cityId
        }
    }
    if (types.includes(ActionType.Expand)) {
        const companyId = hydrated.operatingCompanyId
        assertExists(companyId, 'Expected an operating company to expand')
        const [areaId] = hydrated.validExpansionAreaIds(companyId)
        assertExists(areaId, `Expected an expansion area for ${companyId}`)
        return { ...base, type: ActionType.Expand, areaId }
    }
    throw Error(`No bot action for ${playerId} in ${state.machineState}: ${types.join(', ')}`)
}
