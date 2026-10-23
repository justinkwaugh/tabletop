import { GameSession } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    ActionType,
    AssignGoods,
    AttemptAnomaly,
    AcceptPact,
    AttemptEvent,
    BuildShip,
    ChooseFaction,
    ChooseDemand,
    ChooseProduction,
    ConvertSettlement,
    DestroyGoods,
    DeclareInitiative,
    Mine,
    PassConversion,
    PlaceEvent,
    PlaceHomesteaders,
    PlaceRewardGoods,
    PlaceRewardSettlements,
    ProposePact,
    SellGoods,
    Research,
    TerraformWithShip,
    WithdrawPact,
    SpendInfluence,
    ChooseSurveyWorld,
    ChooseTerraformWorld,
    CloneSettlement,
    DevelopTech,
    EndPhase,
    Explore,
    MoveShip,
    PassTerraform,
    PlaceStartingBase,
    RepairMethod,
    RepairShip,
    ScrapShip,
    Terraform,
    TransferCargo,
    TransferGoods,
    TurnPhase,
    MachineState,
    GoodsHolderKind,
    PactTargetKind,
    SOL_SYSTEM_ID,
    anomalyAttemptShips,
    assignmentProblem,
    assignmentSystems,
    canAssignToEarth,
    goodsRewardProblem,
    eventAttemptShips,
    eventPlacementSystems,
    homesteadSystems,
    isValidEventAttempt,
    pactTarget,
    rewardPlacementSystems,
    termsProblem,
    usesAnomalyRewards,
    canExplore,
    carriesCargo,
    hasArrived,
    isTechAvailable,
    isValidAnomalyAttempt,
    moveOptions,
    phaseOfMachineState,
    playPhase,
    sameCargoPartner,
    saleOptions,
    sameHolder,
    goodsCount,
    storeRooms,
    rewardGoodsHolders,
    transferPartners,
    type CargoPartner,
    type Faction,
    type GoodsAssignment,
    type GoodsHolder,
    type GoodsReward,
    type SaleOption,
    type StoreRoom,
    type TradeGood,
    type HydratedStellarHorizonsGameState,
    type AnomalyChallenge,
    type MoveOption,
    type Pact,
    type PactOpening,
    type PactShare,
    type PactTerms,
    type RewardPlacement,
    type Production,
    type ShipState,
    type StellarHorizonsProjectedState,
    type TechId
} from '@tabletop/stellar-horizons-2'
import { cargoDraftFits } from '$lib/utils/cargoTransferView.js'
import { evenShares, type ShareItem } from '$lib/utils/pacts.js'
import { plural, systemName } from '$lib/utils/presentation.js'
import {
    goodName,
    goodsToSell,
    holderCounts,
    saleSources,
    type GoodsGroup
} from '$lib/utils/trade.js'
import {
    DISCARDED,
    anomalySelection,
    assignmentSelection,
    rewardGoodsSelection,
    saleSelection,
    selectedAssignmentDraft,
    selectedRewardGoodsDraft,
    selectedSaleDraft,
    type AssignmentDraft,
    type GoodsDestination,
    type RewardGoodsDraft,
    type SaleDraft,
    eventSelection,
    pactSelection,
    popSelection,
    rewardSelection,
    selectedAnomalyDraft,
    selectedEventDraft,
    selectedPactDraft,
    selectedRewardDraft,
    toggleEventShip,
    type EventDraft,
    type PactDraft,
    type RewardDraft,
    selectedShipId,
    selectedTechId,
    shipSelection,
    techSelection,
    toggleAnomalyShip,
    type AnomalyDraft,
    type Selection
} from './selection.js'

const SHIP_SELECTION_PHASES: readonly TurnPhase[] = [
    TurnPhase.Build,
    TurnPhase.Cargo,
    TurnPhase.Movement,
    TurnPhase.Exploration
]

export type PhaseProgress = 'done' | 'playing' | 'pending'

export interface PhaseOrderEntry {
    playerId: string
    progress: PhaseProgress
}

// Settlements and goods moving onto the chosen ship from its partner; negative counts move off.
export interface CargoDraft {
    partner: CargoPartner
    settlements: number
    goods: GoodsGroup[]
}

// A system the map offers for the current choice, with what choosing it does.
export interface MapTarget {
    systemId: string
    label: string
    action: string
}

export interface ShipClump {
    systemId: string
    playerId: string
    ships: ShipState[]
}

function rewardKey(reward: GoodsReward): string {
    return `${reward.anomalyId}:${reward.systemId}:${reward.playerId}`
}

export class StellarHorizonsGameSession extends GameSession<
    StellarHorizonsProjectedState,
    HydratedStellarHorizonsGameState
> {
    private selection: Selection | undefined = $state()
    private cargoDraft: CargoDraft | undefined = $state()
    private inspected: { systemId: string; playerId: string } | undefined = $state()
    private focus: { systemId: string; closing: boolean } | undefined = $state()
    private leftRewardFocus: string | undefined = $state()
    private consolePlayer: string | undefined = $state()

    myPlayerId: string | undefined = $derived(this.myPlayer?.id)

    canAct: boolean = $derived(this.isMyTurn && !this.isViewingHistory)

    // The phase of the decade in progress, whether the viewer is playing it or waiting on others.
    currentPhase: TurnPhase | undefined = $derived(phaseOfMachineState(this.gameState.machineState))

    // The phase the viewer is playing in their own branch.
    myPhase: TurnPhase | undefined = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId && this.gameState.isActivePlayer(playerId)
            ? playPhase(this.gameState)
            : undefined
    })

    actingPhase: TurnPhase | undefined = $derived(this.canAct ? this.myPhase : undefined)

    // Who plays the phase, in the order their play lands on the main line, and how far each is.
    phaseOrder: PhaseOrderEntry[] = $derived.by(() => {
        const span = this.gameState.parallelSpan
        const remainingTraders = this.gameState.remainingTraders
        if (this.gameState.machineState === MachineState.Trading) {
            return this.gameState.initiativeOrder().map((playerId) => ({
                playerId,
                progress: !remainingTraders.includes(playerId)
                    ? 'done'
                    : remainingTraders[0] === playerId
                      ? 'playing'
                      : 'pending'
            }))
        }
        if (!span || this.currentPhase === undefined) {
            return []
        }
        return span.playerIds.map((playerId) => ({
            playerId,
            progress:
                span.mergedPlayerIds.includes(playerId) || span.closedPlayerIds.includes(playerId)
                    ? 'done'
                    : span.branchPlayerId === undefined || span.branchPlayerId === playerId
                      ? 'playing'
                      : 'pending'
        }))
    })

    selectedShip: ShipState | undefined = $derived.by(() => {
        const shipId = selectedShipId(this.selection)
        const playerId = this.myPlayerId
        const phase = this.actingPhase
        if (!shipId || !playerId || !phase || !SHIP_SELECTION_PHASES.includes(phase)) {
            return undefined
        }
        return this.gameState.playerShip(playerId, shipId)
    })

    selectedTech: TechId | undefined = $derived.by(() => {
        const techId = selectedTechId(this.selection)
        const playerId = this.myPlayerId
        if (!techId || !playerId || this.actingPhase !== TurnPhase.Development) {
            return undefined
        }
        return isTechAvailable(this.gameState, playerId, techId) ? techId : undefined
    })

    // The ships chosen so far for an anomaly, less any that can no longer take part.
    anomalyDraft: AnomalyDraft | undefined = $derived.by(() => {
        const draft = selectedAnomalyDraft(this.selection)
        const playerId = this.myPlayerId
        if (!draft || !playerId || this.actingPhase !== TurnPhase.Exploration) {
            return undefined
        }
        if (!this.gameState.isSystemInPlay(draft.systemId)) {
            return undefined
        }
        const available = anomalyAttemptShips(this.gameState, playerId, draft.systemId).map(
            (ship) => ship.shipId
        )
        const shipIds = draft.shipIds.filter((shipId) => available.includes(shipId))
        return shipIds.length > 0 ? { systemId: draft.systemId, shipIds } : undefined
    })

    cargoShip: ShipState | undefined = $derived.by(() => {
        const ship = this.selectedShip
        return ship && this.actingPhase === TurnPhase.Cargo && carriesCargo(this.gameState, ship)
            ? ship
            : undefined
    })

    // In the campaign goods move too: to and from Earth at Sol, a base, or another ship.
    cargoPartners: CargoPartner[] = $derived.by(() => {
        const ship = this.cargoShip
        if (!ship) {
            return []
        }
        return transferPartners(this.gameState, ship)
    })

    cargoPartner: CargoPartner | undefined = $derived.by(() => {
        const chosen = this.cargoDraft?.partner
        const kept = chosen
            ? this.cargoPartners.find((partner) => sameCargoPartner(partner, chosen))
            : undefined
        return kept ?? this.cargoPartners.at(0)
    })

    // The cargo draft for the chosen ship and partner, while it still fits.
    cargoMoves: CargoDraft | undefined = $derived.by(() => {
        const ship = this.cargoShip
        const partner = this.cargoPartner
        const draft = this.cargoDraft
        if (!ship || !partner) {
            return undefined
        }
        if (
            !draft ||
            !sameCargoPartner(draft.partner, partner) ||
            !cargoDraftFits(this.gameState, ship, draft)
        ) {
            return { partner, settlements: 0, goods: [] }
        }
        return draft
    })

    draftedSettlements: number = $derived(this.cargoMoves?.settlements ?? 0)

    moveTargets: MoveOption[] = $derived.by(() => {
        const ship = this.selectedShip
        if (!ship || this.actingPhase !== TurnPhase.Movement) {
            return []
        }
        return moveOptions(this.gameState, ship)
    })

    // The ships chosen so far for an event, less any that can no longer take part.
    eventDraft: EventDraft | undefined = $derived.by(() => {
        const draft = selectedEventDraft(this.selection)
        const playerId = this.myPlayerId
        if (!draft || !playerId || this.actingPhase !== TurnPhase.Exploration) {
            return undefined
        }
        const available = eventAttemptShips(
            this.gameState,
            playerId,
            draft.eventId,
            draft.challenge
        ).map((ship) => ship.shipId)
        return { ...draft, shipIds: draft.shipIds.filter((shipId) => available.includes(shipId)) }
    })

    pactDraft: PactDraft | undefined = $derived.by(() => {
        const draft = selectedPactDraft(this.selection)
        if (
            !draft ||
            this.isViewingHistory ||
            !this.validActionTypes.includes(ActionType.ProposePact) ||
            !pactTarget(this.gameState, draft.opening, draft.partnerIds)
        ) {
            return undefined
        }
        return draft
    })

    pactTerms: PactTerms | undefined = $derived.by(() => {
        const draft = this.pactDraft
        const playerId = this.myPlayerId
        const target = draft && pactTarget(this.gameState, draft.opening, draft.partnerIds)
        if (!draft || !playerId || !target) {
            return undefined
        }
        const shares = draft.shares ?? evenShares(target.reward, draft.partnerIds, playerId)
        const keeps =
            !usesAnomalyRewards(this.gameState) &&
            draft.opening.targetKind === PactTargetKind.Anomaly
        return {
            targetKind: draft.opening.targetKind,
            targetId: draft.opening.targetId,
            challenge: draft.opening.challenge,
            partnerIds: draft.partnerIds,
            pledges: Object.fromEntries(
                draft.partnerIds.map((partnerId) => [partnerId, draft.pledges[partnerId] ?? []])
            ),
            shares: Object.fromEntries(
                draft.partnerIds.map((partnerId) => [partnerId, shares[partnerId]])
            ),
            ...(keeps ? { keeperId: draft.keeperId ?? playerId } : {})
        }
    })

    pactProblem: string | undefined = $derived.by(() => {
        const terms = this.pactTerms
        const playerId = this.myPlayerId
        return terms && playerId
            ? termsProblem(this.gameState, playerId, terms, this.pactDraft?.counteredPactId)
            : undefined
    })

    rewardDraft: RewardDraft = $derived.by(() => {
        const draft = selectedRewardDraft(this.selection)
        const reward = this.gameState.settlementRewards.at(0)
        if (
            !draft ||
            !reward ||
            !this.canAct ||
            this.gameState.machineState !== MachineState.PlacingRewardSettlements
        ) {
            return { systemIds: [] }
        }
        const allowed = rewardPlacementSystems(this.gameState)
        return {
            systemIds: draft.systemIds
                .filter((systemId) => allowed.includes(systemId))
                .slice(0, reward.settlements)
        }
    })

    // Where each drawn good goes so far, in the order drawn.
    assignmentDraft: AssignmentDraft = $derived.by(() => {
        const draft = selectedAssignmentDraft(this.selection)
        const playerId = this.myPlayerId
        if (!draft || !playerId || this.actingPhase !== TurnPhase.TradeGoods) {
            return { destinations: [] }
        }
        const drawn = this.gameState.getPlayerState(playerId).drawnGoods
        return { destinations: draft.destinations.slice(0, drawn.length) }
    })

    drawnGoods: TradeGood[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId && this.actingPhase === TurnPhase.TradeGoods
            ? this.gameState.getPlayerState(playerId).drawnGoods
            : []
    })

    goodToAssign: TradeGood | undefined = $derived(
        this.drawnGoods[this.assignmentDraft.destinations.length]
    )

    // Earth and each base with the goods assigned so far.
    assignmentRooms: StoreRoom[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId
            ? storeRooms(
                  this.gameState,
                  playerId,
                  this.goodsAssignments(this.assignmentDraft.destinations)
              )
            : []
    })

    heldGoods: number = $derived(this.myPlayerId ? goodsCount(this.gameState, this.myPlayerId) : 0)

    assignmentProblem: string | undefined = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId
            ? assignmentProblem(
                  this.gameState,
                  playerId,
                  this.goodsAssignments(this.assignmentDraft.destinations)
              )
            : undefined
    })

    myGoodsReward: GoodsReward | undefined = $derived(
        this.canAct && this.gameState.machineState === MachineState.PlacingRewardGoods
            ? this.gameState.goodsRewards.at(0)
            : undefined
    )

    rewardGoodsDraft: RewardGoodsDraft = $derived.by(() => {
        const draft = selectedRewardGoodsDraft(this.selection)
        if (
            !draft ||
            !this.myGoodsReward ||
            goodsRewardProblem(this.gameState, holderCounts(draft.holders)) !== undefined
        ) {
            return { holders: [] }
        }
        return draft
    })

    // The ships and base that can take another of the reward's goods.
    rewardHolders: GoodsHolder[] = $derived.by(() => {
        const reward = this.myGoodsReward
        if (!reward) {
            return []
        }
        const placed = this.rewardGoodsDraft.holders
        return rewardGoodsHolders(this.gameState, reward).filter(
            (holder) =>
                placed.length < reward.count &&
                goodsRewardProblem(this.gameState, holderCounts([...placed, holder])) === undefined
        )
    })

    saleOptions: SaleOption[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId &&
            this.actingPhase === TurnPhase.Cargo &&
            this.validActionTypes.includes(ActionType.SellGoods)
            ? saleOptions(this.gameState, playerId)
            : []
    })

    // The sale being set up, while its goods are still there to sell.
    saleDraft: SaleDraft | undefined = $derived.by(() => {
        const draft = selectedSaleDraft(this.selection)
        const option = draft && this.saleOption(draft.systemId, draft.good)
        if (!draft || !option) {
            return undefined
        }
        if (draft.count > goodsToSell(option)) {
            return undefined
        }
        return {
            ...draft,
            payeeId:
                draft.payeeId ?? (option.payeeIds.length === 1 ? option.payeeIds[0] : undefined)
        }
    })

    mapTargets: MapTarget[] = $derived.by(() => {
        const playerId = this.myPlayerId
        if (!playerId) {
            return []
        }
        if (this.moveTargets.length > 0) {
            return this.moveTargets.map((target) => ({
                systemId: target.systemId,
                label: plural(target.turns, 'turn'),
                action: `Move to ${systemName(target.systemId)}`
            }))
        }
        if (!this.canAct) {
            return []
        }
        switch (this.gameState.machineState) {
            case MachineState.PlacingEvent:
                return eventPlacementSystems(this.gameState, playerId).map((systemId) => ({
                    systemId,
                    label: 'Place the event',
                    action: `Place the event at ${systemName(systemId)}`
                }))
            case MachineState.PlacingHomesteaders:
                return homesteadSystems(this.gameState, playerId).map((systemId) => ({
                    systemId,
                    label: '+2 settlements',
                    action: `Homesteaders to ${systemName(systemId)}`
                }))
            case MachineState.PlacingRewardSettlements:
                return this.rewardTargets()
            case MachineState.AssigningGoods:
                return this.assignmentTargets(playerId)
            case MachineState.PlacingRewardGoods:
                return this.rewardGoodsTargets()
            case MachineState.Trading:
                return this.saleTargets()
            default:
                return []
        }
    })

    selectableShipIds: string[] = $derived.by(() => {
        const playerId = this.myPlayerId
        const phase = this.actingPhase
        if (!playerId || !phase || !SHIP_SELECTION_PHASES.includes(phase)) {
            return []
        }
        return this.gameState
            .shipsOf(playerId)
            .filter((ship) => this.isShipActionable(ship, phase))
            .map((ship) => ship.shipId)
    })

    private isShipActionable(ship: ShipState, phase: TurnPhase): boolean {
        switch (phase) {
            case TurnPhase.Movement:
                return hasArrived(ship)
            case TurnPhase.Exploration:
                return canExplore(this.gameState, ship)
            default:
                return true
        }
    }

    inspectedClump: ShipClump | undefined = $derived.by(() => {
        const inspected = this.inspected
        if (!inspected) {
            return undefined
        }
        const ships = this.gameState
            .allShips()
            .filter(
                (ship) =>
                    ship.systemId === inspected.systemId && ship.playerId === inspected.playerId
            )
        return ships.length > 0 ? { ...inspected, ships } : undefined
    })

    toggleClump(systemId: string, playerId: string) {
        const current = this.inspectedClump
        this.inspected =
            current?.systemId === systemId && current.playerId === playerId
                ? undefined
                : { systemId, playerId }
    }

    closeClump() {
        this.inspected = undefined
    }

    // Reward goods go to ships and a base in one system, so the map zooms into it until the
    // Player leaves it.
    private rewardFocus: string | undefined = $derived.by(() => {
        const reward = this.myGoodsReward
        return reward && rewardKey(reward) !== this.leftRewardFocus ? reward.systemId : undefined
    })

    focusedSystemId: string | undefined = $derived.by(() => {
        const systemId = this.focus?.systemId ?? this.rewardFocus
        return systemId && this.gameState.isSystemInPlay(systemId) ? systemId : undefined
    })

    focusClosing: boolean = $derived(this.focus?.closing ?? false)

    // The player whose console the player area shows: the one chosen from the standings,
    // otherwise the viewer.
    consolePlayerId: string | undefined = $derived.by(() => {
        const chosen = this.consolePlayer
        return chosen && this.gameState.players.some((player) => player.playerId === chosen)
            ? chosen
            : (this.myPlayerId ?? this.gameState.initiativeOrder().at(0))
    })

    showConsole(playerId: string) {
        this.consolePlayer = playerId
    }

    focusSystem(systemId: string) {
        this.closeClump()
        this.focus = { systemId, closing: false }
    }

    leaveFocus() {
        const systemId = this.focusedSystemId
        const reward = this.myGoodsReward
        if (reward && this.rewardFocus) {
            this.leftRewardFocus = rewardKey(reward)
        }
        if (systemId) {
            this.focus = { systemId, closing: true }
        }
        if (this.saleDraft) {
            this.clearSelection()
        }
    }

    finishLeavingFocus() {
        this.focus = undefined
    }

    selectShipFromClump(shipId: string) {
        this.closeClump()
        this.selectShip(shipId)
    }

    hasManualSelection(): boolean {
        return this.selection !== undefined
    }

    selectShip(shipId: string) {
        this.select(selectedShipId(this.selection) === shipId ? undefined : shipSelection(shipId))
    }

    // Choosing a ship from the action panel also shows where it is: the map zooms into its
    // system. Choosing it again clears the choice and returns to the map.
    locateShip(shipId: string) {
        const playerId = this.myPlayerId
        const ship = playerId ? this.gameState.playerShip(playerId, shipId) : undefined
        if (!ship) {
            return
        }
        if (selectedShipId(this.selection) === shipId) {
            this.select(undefined)
            this.leaveFocus()
            return
        }
        this.select(shipSelection(shipId))
        this.focusSystem(ship.systemId)
    }

    toggleAnomalyShip(systemId: string, shipId: string) {
        const draft = toggleAnomalyShip(this.anomalyDraft, systemId, shipId)
        this.select(draft ? anomalySelection(draft) : undefined)
    }

    async commitAnomalyDraft() {
        const draft = this.anomalyDraft
        const playerId = this.myPlayerId
        if (
            !draft ||
            !playerId ||
            !isValidAnomalyAttempt(this.gameState, playerId, draft.systemId, draft.shipIds)
        ) {
            return
        }
        this.clearSelection()
        await this.commit(ActionType.AttemptAnomaly, this.createPlayerAction(AttemptAnomaly, draft))
    }

    chooseEventChallenge(eventId: string, challenge: AnomalyChallenge) {
        this.select(eventSelection({ eventId, challenge, shipIds: [] }))
    }

    toggleEventShip(eventId: string, challenge: AnomalyChallenge, shipId: string) {
        const draft = toggleEventShip(this.eventDraft, eventId, challenge, shipId)
        this.select(draft ? eventSelection(draft) : undefined)
    }

    async commitEventDraft() {
        const draft = this.eventDraft
        const playerId = this.myPlayerId
        if (
            !draft ||
            !playerId ||
            !isValidEventAttempt(
                this.gameState,
                playerId,
                draft.eventId,
                draft.challenge,
                draft.shipIds
            )
        ) {
            return
        }
        this.clearSelection()
        await this.commit(ActionType.AttemptEvent, this.createPlayerAction(AttemptEvent, draft))
    }

    // Opening the editor again for the same target and offer closes it.
    openPactDraft(opening: PactOpening, countered?: Pact) {
        const playerId = this.myPlayerId
        const current = this.pactDraft
        if (!playerId) {
            return
        }
        if (
            current &&
            current.counteredPactId === countered?.id &&
            this.isSamePactOpening(current.opening, opening)
        ) {
            this.clearSelection()
            return
        }
        this.select(
            pactSelection(
                countered
                    ? {
                          opening,
                          counteredPactId: countered.id,
                          partnerIds: [...countered.terms.partnerIds],
                          pledges: Object.fromEntries(
                              Object.entries(countered.terms.pledges).map(
                                  ([partnerId, shipIds]) => [partnerId, [...shipIds]]
                              )
                          ),
                          shares: Object.fromEntries(
                              Object.entries(countered.terms.shares).map(([partnerId, share]) => [
                                  partnerId,
                                  { ...share }
                              ])
                          ),
                          keeperId: countered.terms.keeperId
                      }
                    : { opening, partnerIds: [playerId], pledges: { [playerId]: [] } }
            )
        )
    }

    togglePactPartner(partnerId: string) {
        this.updatePactDraft((draft) => ({
            ...draft,
            partnerIds: draft.partnerIds.includes(partnerId)
                ? draft.partnerIds.filter((candidate) => candidate !== partnerId)
                : [...draft.partnerIds, partnerId],
            shares: undefined
        }))
    }

    togglePactShip(partnerId: string, shipId: string) {
        this.updatePactDraft((draft) => {
            const pledged = draft.pledges[partnerId] ?? []
            return {
                ...draft,
                pledges: {
                    ...draft.pledges,
                    [partnerId]: pledged.includes(shipId)
                        ? pledged.filter((candidate) => candidate !== shipId)
                        : [...pledged, shipId]
                }
            }
        })
    }

    adjustPactShare(partnerId: string, item: ShareItem, change: number) {
        const terms = this.pactTerms
        if (!terms) {
            return
        }
        const shares: Record<string, PactShare> = Object.fromEntries(
            Object.entries(terms.shares).map(([id, share]) => [id, { ...share }])
        )
        shares[partnerId][item] = Math.max(0, shares[partnerId][item] + change)
        this.updatePactDraft((draft) => ({ ...draft, shares }))
    }

    choosePactKeeper(partnerId: string) {
        this.updatePactDraft((draft) => ({ ...draft, keeperId: partnerId }))
    }

    async proposePactDraft() {
        const terms = this.pactTerms
        const draft = this.pactDraft
        if (!terms || !draft || this.pactProblem) {
            return
        }
        this.clearSelection()
        await this.proposePact(terms, draft.counteredPactId)
    }

    async chooseMapTarget(systemId: string) {
        if (!this.mapTargets.some((target) => target.systemId === systemId)) {
            return
        }
        switch (this.gameState.machineState) {
            case MachineState.PlacingEvent:
                await this.placeEvent(systemId)
                return
            case MachineState.PlacingHomesteaders:
                await this.placeHomesteaders(systemId)
                return
            case MachineState.PlacingRewardSettlements:
                this.select(
                    rewardSelection({ systemIds: [...this.rewardDraft.systemIds, systemId] })
                )
                return
            case MachineState.PlacingRewardGoods:
                this.focusSystem(systemId)
                return
            case MachineState.Trading: {
                const [option] = this.salesIn(systemId)
                if (option && this.saleDraft?.systemId !== systemId) {
                    this.chooseSale(option)
                }
                this.focusSystem(systemId)
                return
            }
            case MachineState.AssigningGoods:
                this.assignGoodTo(
                    systemId === SOL_SYSTEM_ID
                        ? { kind: GoodsHolderKind.Earth }
                        : { kind: GoodsHolderKind.Base, systemId }
                )
                return
            default:
                await this.moveSelectedShip(systemId)
        }
    }

    async commitRewardDraft() {
        const reward = this.gameState.settlementRewards.at(0)
        const systemIds = this.rewardDraft.systemIds
        if (!reward || systemIds.length !== reward.settlements) {
            return
        }
        const placements = [...new Set(systemIds)].map((systemId) => ({
            systemId,
            settlements: systemIds.filter((candidate) => candidate === systemId).length
        }))
        this.clearSelection()
        await this.placeRewardSettlements(placements)
    }

    discardGoodToAssign() {
        this.assignGoodTo(DISCARDED)
    }

    async commitAssignment() {
        const playerId = this.myPlayerId
        const destinations = this.assignmentDraft.destinations
        if (
            !playerId ||
            destinations.length !== this.gameState.getPlayerState(playerId).drawnGoods.length ||
            this.assignmentProblem
        ) {
            return
        }
        this.clearSelection()
        await this.commit(
            ActionType.AssignGoods,
            this.createPlayerAction(AssignGoods, {
                assignments: this.goodsAssignments(destinations)
            })
        )
    }

    async chooseDemand(good: TradeGood) {
        await this.commit(ActionType.ChooseDemand, this.createPlayerAction(ChooseDemand, { good }))
    }

    addRewardGood(holder: GoodsHolder) {
        const holders = [...this.rewardGoodsDraft.holders, holder]
        if (goodsRewardProblem(this.gameState, holderCounts(holders)) === undefined) {
            this.select(rewardGoodsSelection({ holders }))
        }
    }

    canTakeRewardGood(holder: GoodsHolder): boolean {
        return this.rewardHolders.some((candidate) => sameHolder(candidate, holder))
    }

    // A holder's goods with the reward goods placed there so far.
    goodsWithReward(holder: GoodsHolder, goods: readonly TradeGood[]): TradeGood[] {
        const reward = this.myGoodsReward
        if (!reward) {
            return [...goods]
        }
        const placed = this.rewardGoodsDraft.holders.filter((candidate) =>
            sameHolder(candidate, holder)
        ).length
        return [...goods, ...Array.from({ length: placed }, () => reward.good)]
    }

    async commitRewardGoods() {
        const placements = holderCounts(this.rewardGoodsDraft.holders)
        this.leaveFocus()
        this.clearSelection()
        await this.commit(
            ActionType.PlaceRewardGoods,
            this.createPlayerAction(PlaceRewardGoods, { placements })
        )
    }

    salesIn(systemId: string): SaleOption[] {
        return this.saleOptions.filter((option) => option.systemId === systemId)
    }

    // A ship chosen in the system panel takes a reward good while those are placed; otherwise it
    // is chosen for the phase.
    chooseShipHere(shipId: string) {
        const holder: GoodsHolder = { kind: GoodsHolderKind.Ship, shipId }
        if (this.canTakeRewardGood(holder)) {
            this.addRewardGood(holder)
        } else if (this.selectableShipIds.includes(shipId)) {
            this.selectShip(shipId)
        }
    }

    // Choosing a sale sets it up to sell everything; choosing it again puts it away.
    chooseSale(option: SaleOption) {
        const current = this.saleDraft
        if (current?.systemId === option.systemId && current.good === option.good) {
            this.clearSelection()
            return
        }
        this.select(
            saleSelection({
                systemId: option.systemId,
                good: option.good,
                count: goodsToSell(option)
            })
        )
    }

    adjustSaleCount(change: number) {
        const draft = this.saleDraft
        const option = draft && this.saleOption(draft.systemId, draft.good)
        if (draft && option) {
            const count = Math.min(Math.max(1, draft.count + change), goodsToSell(option))
            this.select(saleSelection({ ...draft, count }))
        }
    }

    chooseSalePayee(payeeId: string) {
        const draft = this.saleDraft
        if (draft) {
            this.select(saleSelection({ ...draft, payeeId }))
        }
    }

    async commitSale() {
        const draft = this.saleDraft
        const option = draft && this.saleOption(draft.systemId, draft.good)
        if (!draft || !option) {
            return
        }
        this.clearSelection()
        await this.commit(
            ActionType.SellGoods,
            this.createPlayerAction(SellGoods, {
                systemId: draft.systemId,
                good: draft.good,
                sources: saleSources(option, draft.count),
                ...(draft.payeeId ? { payeeId: draft.payeeId } : {})
            })
        )
    }

    async destroyGood(holder: GoodsHolder, good: TradeGood) {
        await this.commit(
            ActionType.DestroyGoods,
            this.createPlayerAction(DestroyGoods, { holder, good, count: 1 })
        )
    }

    selectTech(techId: TechId) {
        this.select(selectedTechId(this.selection) === techId ? undefined : techSelection(techId))
    }

    clearSelection() {
        this.select(undefined)
    }

    chooseCargoPartner(partner: CargoPartner) {
        this.cargoDraft = { partner, settlements: 0, goods: [] }
    }

    draftCargo(direction: 1 | -1) {
        this.changeCargoDraft((draft) => ({ ...draft, settlements: draft.settlements + direction }))
    }

    draftGoods(good: TradeGood, direction: 1 | -1) {
        this.changeCargoDraft((draft) => {
            const count = (draft.goods.find((move) => move.good === good)?.count ?? 0) + direction
            const others = draft.goods.filter((move) => move.good !== good)
            return { ...draft, goods: count === 0 ? others : [...others, { good, count }] }
        })
    }

    // Everything coming off the ship moves first, so what goes on finds room.
    async commitCargoDraft() {
        const ship = this.cargoShip
        const draft = this.cargoMoves
        if (!ship || !draft) {
            return
        }
        const goods = draft.goods
        if (draft.settlements === 0 && goods.length === 0) {
            return
        }
        const partner = draft.partner
        this.cargoDraft = { partner, settlements: 0, goods: [] }
        const moves = [
            ...(draft.settlements !== 0 ? [{ count: draft.settlements }] : []),
            ...goods
        ].toSorted((a, b) => a.count - b.count)
        for (const move of moves) {
            if ('good' in move) {
                await this.commit(
                    ActionType.TransferGoods,
                    this.createPlayerAction(TransferGoods, {
                        shipId: ship.shipId,
                        partner,
                        good: move.good,
                        count: move.count
                    })
                )
            } else {
                await this.commit(
                    ActionType.TransferCargo,
                    this.createPlayerAction(TransferCargo, {
                        shipId: ship.shipId,
                        partner,
                        settlements: move.count
                    })
                )
            }
        }
        if (this.myPhase !== TurnPhase.Cargo) {
            this.clearSelection()
            this.enterPhase()
        }
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.select(popSelection(this.selection))
            return
        }
        await super.undo()
    }

    resetAction() {
        this.select(undefined)
    }

    // Movement starts from the whole map, so every destination is in view.
    private enterPhase() {
        if (this.myPhase === TurnPhase.Movement) {
            this.leaveFocus()
        }
    }

    private rewardGoodsTargets(): MapTarget[] {
        const reward = this.myGoodsReward
        if (!reward || this.focusedSystemId === reward.systemId) {
            return []
        }
        return [
            {
                systemId: reward.systemId,
                label: `${reward.count} ${goodName(reward.good)} to place`,
                action: `Place ${goodName(reward.good)} at ${systemName(reward.systemId)}`
            }
        ]
    }

    // Each system with goods to sell, its price on the label when only one good sells there.
    private saleTargets(): MapTarget[] {
        const systemIds = new Set(this.saleOptions.map((option) => option.systemId))
        return [...systemIds]
            .filter((systemId) => systemId !== this.focusedSystemId)
            .map((systemId) => {
                const options = this.salesIn(systemId)
                const [only] = options
                return {
                    systemId,
                    label:
                        options.length === 1
                            ? `Sell ${goodName(only.good)} $${only.price}B`
                            : `Sell ${options.length} goods`,
                    action: `Sell goods at ${systemName(systemId)}`
                }
            })
    }

    private rewardTargets(): MapTarget[] {
        const reward = this.gameState.settlementRewards.at(0)
        const placed = this.rewardDraft.systemIds
        if (!reward || placed.length >= reward.settlements) {
            return []
        }
        return rewardPlacementSystems(this.gameState).map((systemId) => {
            const count = placed.filter((candidate) => candidate === systemId).length
            return {
                systemId,
                label: count > 0 ? `+${count}, add another` : 'Add a settlement',
                action: `Add a settlement at ${systemName(systemId)}`
            }
        })
    }

    private isSamePactOpening(a: PactOpening, b: PactOpening): boolean {
        return (
            a.targetKind === b.targetKind &&
            a.targetId === b.targetId &&
            a.challenge === b.challenge &&
            a.systemId === b.systemId
        )
    }

    private updatePactDraft(change: (draft: PactDraft) => PactDraft) {
        const draft = this.pactDraft
        if (draft) {
            this.select(pactSelection(change(draft)))
        }
    }

    private select(selection: Selection | undefined) {
        this.selection = selection
        this.cargoDraft = undefined
    }

    private changeCargoDraft(change: (draft: CargoDraft) => CargoDraft) {
        const ship = this.cargoShip
        const draft = this.cargoMoves
        if (!ship || !draft) {
            return
        }
        const next = change(draft)
        if (cargoDraftFits(this.gameState, ship, next)) {
            this.cargoDraft = next
        }
    }

    private saleOption(systemId: string, good: TradeGood): SaleOption | undefined {
        return this.saleOptions.find(
            (option) => option.systemId === systemId && option.good === good
        )
    }

    private assignGoodTo(destination: GoodsDestination) {
        if (this.goodToAssign === undefined) {
            return
        }
        this.select(
            assignmentSelection({
                destinations: [...this.assignmentDraft.destinations, destination]
            })
        )
    }

    private goodsAssignments(destinations: readonly GoodsDestination[]): GoodsAssignment[] {
        const playerId = this.myPlayerId
        const drawn = playerId ? this.gameState.getPlayerState(playerId).drawnGoods : []
        return destinations.flatMap((destination, index) => {
            const good = drawn[index]
            return good === undefined || destination.kind === DISCARDED.kind
                ? []
                : [{ good, store: destination }]
        })
    }

    // The bases the next drawn good may go to, and Sol for Earth, each with room left for it.
    private assignmentTargets(playerId: string): MapTarget[] {
        const good = this.goodToAssign
        if (good === undefined) {
            return []
        }
        const destinations = this.assignmentDraft.destinations
        const fits = (destination: GoodsDestination) =>
            assignmentProblem(
                this.gameState,
                playerId,
                this.goodsAssignments([...destinations, destination])
            ) === undefined
        const name = goodName(good)
        const bases = assignmentSystems(this.gameState, playerId, good)
            .filter((systemId) => fits({ kind: GoodsHolderKind.Base, systemId }))
            .map((systemId) => ({
                systemId,
                label: `${name} here`,
                action: `Assign ${name} to your base at ${systemName(systemId)}`
            }))
        return canAssignToEarth(good) && fits({ kind: GoodsHolderKind.Earth })
            ? [
                  ...bases,
                  {
                      systemId: SOL_SYSTEM_ID,
                      label: `${name} to Earth`,
                      action: `Assign ${name} to Earth`
                  }
              ]
            : bases
    }

    private async commit(type: ActionType, action: GameAction) {
        if (!this.validActionTypes.includes(type)) {
            return
        }
        await this.applyAction(action)
    }

    async chooseFaction(faction: Faction) {
        await this.commit(
            ActionType.ChooseFaction,
            this.createPlayerAction(ChooseFaction, { faction })
        )
    }

    async placeStartingBase(systemId: string) {
        await this.commit(
            ActionType.PlaceStartingBase,
            this.createPlayerAction(PlaceStartingBase, { systemId })
        )
    }

    async buildShip(shipId: string, systemId: string) {
        await this.commit(
            ActionType.BuildShip,
            this.createPlayerAction(BuildShip, { shipId, systemId })
        )
    }

    async repairShip(shipId: string, method: RepairMethod, points: number) {
        await this.commit(
            ActionType.RepairShip,
            this.createPlayerAction(RepairShip, { shipId, method, points })
        )
    }

    async scrapShip(shipId: string) {
        this.clearSelection()
        await this.commit(ActionType.ScrapShip, this.createPlayerAction(ScrapShip, { shipId }))
    }

    async cloneSettlement(systemId: string) {
        await this.commit(
            ActionType.CloneSettlement,
            this.createPlayerAction(CloneSettlement, { systemId })
        )
    }

    async moveSelectedShip(systemId: string) {
        const ship = this.selectedShip
        if (!ship || !this.moveTargets.some((target) => target.systemId === systemId)) {
            return
        }
        this.clearSelection()
        await this.commit(
            ActionType.MoveShip,
            this.createPlayerAction(MoveShip, { shipId: ship.shipId, systemId })
        )
    }

    async explore(shipId: string) {
        this.clearSelection()
        await this.commit(ActionType.Explore, this.createPlayerAction(Explore, { shipId }))
    }

    async developTech(techId: TechId, markers: number[], cash: number, influence = 0) {
        this.clearSelection()
        await this.commit(
            ActionType.DevelopTech,
            this.createPlayerAction(DevelopTech, {
                techId,
                markers,
                cash,
                ...(influence > 0 ? { influence } : {})
            })
        )
    }

    async spendInfluence(influence: number) {
        await this.commit(
            ActionType.SpendInfluence,
            this.createPlayerAction(SpendInfluence, { influence })
        )
    }

    async declareInitiative(influence: number) {
        await this.commit(
            ActionType.DeclareInitiative,
            this.createPlayerAction(DeclareInitiative, { influence })
        )
    }

    async chooseProduction(systemId: string, production: Production) {
        await this.commit(
            ActionType.ChooseProduction,
            this.createPlayerAction(ChooseProduction, { systemId, production })
        )
    }

    async convertSettlement(systemId: string, targetPlayerId: string) {
        await this.commit(
            ActionType.ConvertSettlement,
            this.createPlayerAction(ConvertSettlement, { systemId, targetPlayerId })
        )
    }

    async mine(shipId: string, slot: number) {
        await this.commit(ActionType.Mine, this.createPlayerAction(Mine, { shipId, slot }))
    }

    async research(shipId: string, slot: number) {
        await this.commit(ActionType.Research, this.createPlayerAction(Research, { shipId, slot }))
    }

    async terraformWithShip(shipId: string, slot: number) {
        await this.commit(
            ActionType.TerraformWithShip,
            this.createPlayerAction(TerraformWithShip, { shipId, slot })
        )
    }

    async attemptEvent(eventId: string, challenge: AnomalyChallenge, shipIds: string[]) {
        await this.commit(
            ActionType.AttemptEvent,
            this.createPlayerAction(AttemptEvent, { eventId, challenge, shipIds })
        )
    }

    async placeEvent(systemId: string) {
        await this.commit(ActionType.PlaceEvent, this.createPlayerAction(PlaceEvent, { systemId }))
    }

    async placeHomesteaders(systemId: string) {
        await this.commit(
            ActionType.PlaceHomesteaders,
            this.createPlayerAction(PlaceHomesteaders, { systemId })
        )
    }

    async placeRewardSettlements(placements: RewardPlacement[]) {
        await this.commit(
            ActionType.PlaceRewardSettlements,
            this.createPlayerAction(PlaceRewardSettlements, { placements })
        )
    }

    // The pact's Common Actions run on the Main Line, even while the Player's Branch is open.
    async proposePact(terms: PactTerms, pactId?: string) {
        await this.commit(
            ActionType.ProposePact,
            this.createPlayerAction(ProposePact, {
                common: true,
                terms,
                ...(pactId ? { pactId } : {})
            })
        )
    }

    async acceptPact(pactId: string, revision: number) {
        await this.commit(
            ActionType.AcceptPact,
            this.createPlayerAction(AcceptPact, { common: true, pactId, revision })
        )
    }

    async withdrawPact(pactId: string) {
        await this.commit(
            ActionType.WithdrawPact,
            this.createPlayerAction(WithdrawPact, { common: true, pactId })
        )
    }

    async passConversion() {
        await this.commit(ActionType.PassConversion, this.createPlayerAction(PassConversion, {}))
    }

    async endPhase() {
        const phase = this.myPhase
        if (!phase) {
            return
        }
        this.clearSelection()
        await this.commit(ActionType.EndPhase, this.createPlayerAction(EndPhase, { phase }))
        this.enterPhase()
    }

    async chooseSurveyWorld(slot: number | undefined) {
        await this.commit(
            ActionType.ChooseSurveyWorld,
            this.createPlayerAction(ChooseSurveyWorld, { slot })
        )
    }

    async terraform(systemId: string, slot: number) {
        await this.commit(
            ActionType.Terraform,
            this.createPlayerAction(Terraform, { systemId, slot })
        )
    }

    async passTerraform() {
        await this.commit(ActionType.PassTerraform, this.createPlayerAction(PassTerraform, {}))
    }

    async chooseTerraformWorld(tileId: string | undefined, removedTileIds: string[]) {
        await this.commit(
            ActionType.ChooseTerraformWorld,
            this.createPlayerAction(ChooseTerraformWorld, { tileId, removedTileIds })
        )
    }
}
