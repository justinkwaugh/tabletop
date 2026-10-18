import { GameSession } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    ActionType,
    AttemptAnomaly,
    AcceptPact,
    AttemptEvent,
    BuildShip,
    ChooseFaction,
    ChooseProduction,
    ConvertSettlement,
    DeclareInitiative,
    Mine,
    PassConversion,
    PlaceEvent,
    PlaceHomesteaders,
    PlaceRewardSettlements,
    ProposePact,
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
    TurnPhase,
    MachineState,
    PactTargetKind,
    anomalyAttemptShips,
    eventAttemptShips,
    eventPlacementSystems,
    homesteadSystems,
    isValidEventAttempt,
    pactTarget,
    rewardPlacementSystems,
    termsProblem,
    usesAnomalyRewards,
    canExplore,
    cargoPartners,
    cargoTransferLimits,
    carriesCargo,
    hasArrived,
    isTechAvailable,
    isValidAnomalyAttempt,
    moveOptions,
    phaseOfMachineState,
    playPhase,
    sameCargoPartner,
    type CargoPartner,
    type Faction,
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
import { evenShares, type ShareItem } from '$lib/utils/pacts.js'
import { plural, systemName } from '$lib/utils/presentation.js'
import {
    anomalySelection,
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

interface CargoDraft {
    partner: CargoPartner
    settlements: number
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

export class StellarHorizonsGameSession extends GameSession<
    StellarHorizonsProjectedState,
    HydratedStellarHorizonsGameState
> {
    private selection: Selection | undefined = $state()
    private cargoDraft: CargoDraft | undefined = $state()
    private inspected: { systemId: string; playerId: string } | undefined = $state()
    private focus: { systemId: string; closing: boolean } | undefined = $state()
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

    cargoPartners: CargoPartner[] = $derived(
        this.cargoShip ? cargoPartners(this.gameState, this.cargoShip) : []
    )

    cargoPartner: CargoPartner | undefined = $derived.by(() => {
        const chosen = this.cargoDraft?.partner
        const kept = chosen
            ? this.cargoPartners.find((partner) => sameCargoPartner(partner, chosen))
            : undefined
        return kept ?? this.cargoPartners.at(0)
    })

    draftedSettlements: number = $derived.by(() => {
        const ship = this.cargoShip
        const partner = this.cargoPartner
        const draft = this.cargoDraft
        if (!ship || !partner || !draft || !sameCargoPartner(draft.partner, partner)) {
            return 0
        }
        return this.isWithinCargoLimits(ship, partner, draft.settlements) ? draft.settlements : 0
    })

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

    focusedSystemId: string | undefined = $derived(
        this.focus && this.gameState.isSystemInPlay(this.focus.systemId)
            ? this.focus.systemId
            : undefined
    )

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
        if (this.focus) {
            this.focus = { ...this.focus, closing: true }
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

    selectTech(techId: TechId) {
        this.select(selectedTechId(this.selection) === techId ? undefined : techSelection(techId))
    }

    clearSelection() {
        this.select(undefined)
    }

    chooseCargoPartner(partner: CargoPartner) {
        this.cargoDraft = { partner, settlements: 0 }
    }

    draftCargo(direction: 1 | -1) {
        const ship = this.cargoShip
        const partner = this.cargoPartner
        if (!ship || !partner) {
            return
        }
        const settlements = this.draftedSettlements + direction
        if (this.isWithinCargoLimits(ship, partner, settlements)) {
            this.cargoDraft = { partner, settlements }
        }
    }

    async commitCargoDraft() {
        const ship = this.cargoShip
        const partner = this.cargoPartner
        const settlements = this.draftedSettlements
        if (!ship || !partner || settlements === 0) {
            return
        }
        this.cargoDraft = { partner, settlements: 0 }
        await this.commit(
            ActionType.TransferCargo,
            this.createPlayerAction(TransferCargo, {
                shipId: ship.shipId,
                partner,
                settlements
            })
        )
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

    private isWithinCargoLimits(
        ship: ShipState,
        partner: CargoPartner,
        settlements: number
    ): boolean {
        const limits = cargoTransferLimits(this.gameState, ship, partner)
        return settlements <= limits.load && -settlements <= limits.unload
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
