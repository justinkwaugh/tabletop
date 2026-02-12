import { GameSession } from '@tabletop/frontend-components'
import {
    AddPassengers,
    ActionType,
    BuildingSites,
    BuildingType,
    ChooseWorkerAction,
    HydratedVroom,
    Pass,
    PlaceBusLine,
    PlaceBuilding,
    StopTime,
    Vroom,
    WorkerActionType,
    extensionSegmentsByTargetNode,
    isBusNodeId,
    isSiteId,
    type HydratedBusGameState,
    type BusGameState,
    type BusLineSegment,
    type BuildingSiteId,
    type BusNodeId,
    type BusStationId,
    validBusLineExtensionSegments,
    validStartingBusLineSegments,
    MachineState
} from '@tabletop/bus'
export class BusGameSession extends GameSession<BusGameState, HydratedBusGameState> {
    chosenSite: BuildingSiteId | undefined = $state()
    pendingBuildingSiteId: BuildingSiteId | undefined = $state()
    chosenPassengerStationId: BusStationId | undefined = $state()
    chosenVroomSourceNodeId: BusNodeId | undefined = $state()
    pendingBusLineTargetNodeId: BusNodeId | undefined = $state()
    isInitialBuildingPlacement = $derived(
        this.gameState.machineState === MachineState.InitialBuildingPlacement
    )
    isInitialBusLinePlacement = $derived(
        this.gameState.machineState === MachineState.InitialBusLinePlacement
    )
    isLineExpansion = $derived(this.gameState.machineState === MachineState.LineExpansion)
    isAddingBuildings = $derived(this.gameState.machineState === MachineState.AddingBuildings)
    isAddingPassengers = $derived(this.gameState.machineState === MachineState.AddingPassengers)
    isVrooming = $derived(this.gameState.machineState === MachineState.Vrooming)
    canVroom = $derived.by(() => {
        return (
            this.isVrooming &&
            this.validActionTypes.includes(ActionType.Vroom) &&
            !!this.myPlayer?.id
        )
    })

    canPlaceBusLine = $derived.by(() => {
        return (
            (this.isInitialBusLinePlacement || this.isLineExpansion) &&
            this.validActionTypes.includes(ActionType.PlaceBusLine) &&
            !!this.myPlayerState
        )
    })

    myBusLineNodeIds: BusNodeId[] = $derived.by(() => {
        const nodeIds = this.myPlayerState?.busLine ?? []
        if (!nodeIds.every(isBusNodeId)) {
            return []
        }
        return [...nodeIds]
    })

    otherBusLineNodeIds: BusNodeId[][] = $derived.by(() => {
        const myPlayerId = this.myPlayer?.id
        if (!myPlayerId) {
            return []
        }

        return this.gameState.players
            .filter((playerState) => playerState.playerId !== myPlayerId)
            .map((playerState) =>
                playerState.busLine.every(isBusNodeId) ? [...playerState.busLine] : []
            )
    })

    startingBusLineSegments: BusLineSegment[] = $derived.by(() => {
        if (!this.canPlaceBusLine || this.myBusLineNodeIds.length > 0) {
            return []
        }
        return validStartingBusLineSegments()
    })

    extensionBusLineSegments: BusLineSegment[] = $derived.by(() => {
        if (!this.canPlaceBusLine || this.myBusLineNodeIds.length === 0) {
            return []
        }
        return validBusLineExtensionSegments(this.myBusLineNodeIds, this.otherBusLineNodeIds)
    })

    extensionBusLineSegmentsByTargetNode = $derived.by(() => {
        if (!this.canPlaceBusLine || this.myBusLineNodeIds.length === 0) {
            return new Map<BusNodeId, BusLineSegment[]>()
        }
        return extensionSegmentsByTargetNode(this.myBusLineNodeIds, this.otherBusLineNodeIds)
    })

    selectableBusLineTargetNodeIds: BusNodeId[] = $derived.by(() => {
        return [...this.extensionBusLineSegmentsByTargetNode.keys()]
    })

    pendingBusLineSourceNodeIds: BusNodeId[] = $derived.by(() => {
        const targetNodeId = this.pendingBusLineTargetNodeId
        if (!targetNodeId) {
            return []
        }

        const segments = this.extensionBusLineSegmentsByTargetNode.get(targetNodeId) ?? []
        return [...new Set(segments.map(([sourceNodeId]) => sourceNodeId))]
    })

    deliverableVroomSourceNodeIds: BusNodeId[] = $derived.by(() => {
        if (!this.canVroom) {
            return []
        }

        const playerId = this.myPlayer?.id
        if (!playerId) {
            return []
        }

        const deliverableNodeIds = new Set<BusNodeId>()
        for (const passenger of this.gameState.board.passengers) {
            if (
                passenger.nodeId &&
                isBusNodeId(passenger.nodeId) &&
                HydratedVroom.canDeliverPassenger(this.gameState, playerId, passenger)
            ) {
                deliverableNodeIds.add(passenger.nodeId)
            }
        }

        return [...deliverableNodeIds]
    })

    vroomDestinationSiteIds: BuildingSiteId[] = $derived.by(() => {
        if (!this.canVroom) {
            return []
        }

        const sourceNodeId = this.chosenVroomSourceNodeId
        if (!sourceNodeId) {
            return []
        }

        const playerBusLineNodeIdSet = new Set(this.myBusLineNodeIds)
        if (!playerBusLineNodeIdSet.has(sourceNodeId)) {
            return []
        }

        if (this.gameState.board.passengersAtNode(sourceNodeId).length === 0) {
            return []
        }

        const destinationSiteIds: BuildingSiteId[] = []
        for (const [siteId, building] of Object.entries(this.gameState.board.buildings)) {
            if (!isSiteId(siteId)) {
                continue
            }
            if (building.type !== this.gameState.currentLocation) {
                continue
            }
            if (this.gameState.board.passengerAtSite(siteId)) {
                continue
            }

            const destinationNodeId = BuildingSites[siteId].nodeId
            if (!playerBusLineNodeIdSet.has(destinationNodeId)) {
                continue
            }

            destinationSiteIds.push(siteId)
        }

        return destinationSiteIds
    })

    back() {
        if (this.pendingBusLineTargetNodeId) {
            this.pendingBusLineTargetNodeId = undefined
            return
        }

        if (this.chosenVroomSourceNodeId) {
            this.chosenVroomSourceNodeId = undefined
            return
        }

        if (this.chosenPassengerStationId) {
            this.chosenPassengerStationId = undefined
            return
        }

        if (this.isInitialBuildingPlacement) {
            if (this.chosenSite) {
                this.chosenSite = undefined
            }
        }
    }

    resetAction() {
        this.chosenSite = undefined
        this.pendingBuildingSiteId = undefined
        this.chosenPassengerStationId = undefined
        this.chosenVroomSourceNodeId = undefined
        this.pendingBusLineTargetNodeId = undefined
    }

    override beforeNewState(): void {
        this.resetAction()
    }

    async placeBuilding(siteId: BuildingSiteId, buildingType: BuildingType) {
        if (!this.validActionTypes.includes(ActionType.PlaceBuilding)) {
            return
        }

        // Clear selection immediately so site highlight/picker do not occlude add animation.
        this.chosenSite = undefined
        this.pendingBuildingSiteId = siteId
        const priorActionCount = this.actions.length

        const action = this.createPlayerAction(PlaceBuilding, {
            siteId,
            buildingType
        })

        await this.applyAction(action)

        // If the action was not accepted/applied, clear pending immediately.
        if (this.actions.length === priorActionCount) {
            this.pendingBuildingSiteId = undefined
        }
    }

    async addPassengers(stationId: BusStationId, numPassengers: number) {
        if (!this.validActionTypes.includes(ActionType.AddPassengers)) {
            return
        }

        const action = this.createPlayerAction(AddPassengers, {
            stationId,
            numPassengers
        })

        await this.applyAction(action)
    }

    async vroom(sourceNode: BusNodeId, destinationSite: BuildingSiteId) {
        if (!this.validActionTypes.includes(ActionType.Vroom)) {
            return
        }

        const action = this.createPlayerAction(Vroom, {
            sourceNode,
            destinationSite
        })

        await this.applyAction(action)
    }

    async placeBusLineSegment(segment: BusLineSegment) {
        if (!this.validActionTypes.includes(ActionType.PlaceBusLine)) {
            return
        }

        const [sourceNodeId, targetNodeId] = segment
        const action = this.createPlayerAction(PlaceBusLine, {
            segment: [sourceNodeId, targetNodeId]
        })

        await this.applyAction(action)
    }

    async chooseWorkerAction(actionType: WorkerActionType) {
        if (!this.validActionTypes.includes(ActionType.ChooseWorkerAction)) {
            return
        }

        const action = this.createPlayerAction(ChooseWorkerAction, { actionType })
        await this.applyAction(action)
    }

    async pass() {
        if (!this.validActionTypes.includes(ActionType.Pass)) {
            return
        }

        const action = this.createPlayerAction(Pass, {})
        await this.applyAction(action)
    }

    async stopTime() {
        if (!this.validActionTypes.includes(ActionType.StopTime)) {
            return
        }

        const action = this.createPlayerAction(StopTime, {})
        await this.applyAction(action)
    }

    chooseVroomSourceNode(sourceNodeId: BusNodeId) {
        if (!this.canVroom) {
            return
        }
        if (!this.deliverableVroomSourceNodeIds.includes(sourceNodeId)) {
            return
        }

        this.chosenVroomSourceNodeId = sourceNodeId
    }

    async chooseVroomDestinationSite(destinationSiteId: BuildingSiteId) {
        if (!this.canVroom) {
            return
        }

        const sourceNodeId = this.chosenVroomSourceNodeId
        if (!sourceNodeId) {
            return
        }
        if (!this.vroomDestinationSiteIds.includes(destinationSiteId)) {
            return
        }

        this.chosenVroomSourceNodeId = undefined
        await this.vroom(sourceNodeId, destinationSiteId)
    }

    segmentOptionsForTargetNode(targetNodeId: BusNodeId): BusLineSegment[] {
        return this.extensionBusLineSegmentsByTargetNode.get(targetNodeId) ?? []
    }

    isAmbiguousBusLineTargetNode(targetNodeId: BusNodeId): boolean {
        return this.segmentOptionsForTargetNode(targetNodeId).length > 1
    }

    unambiguousSegmentForTargetNode(targetNodeId: BusNodeId): BusLineSegment | undefined {
        const segments = this.segmentOptionsForTargetNode(targetNodeId)
        return segments.length === 1 ? segments[0] : undefined
    }

    segmentForSourceAndTargetNode(
        sourceNodeId: BusNodeId,
        targetNodeId: BusNodeId
    ): BusLineSegment | undefined {
        return this.segmentOptionsForTargetNode(targetNodeId).find(
            ([candidateSourceNodeId]) => candidateSourceNodeId === sourceNodeId
        )
    }

    clearPendingBusLineTargetNode() {
        this.pendingBusLineTargetNodeId = undefined
    }

    async chooseBusLineTargetNode(targetNodeId: BusNodeId) {
        if (!this.canPlaceBusLine || this.myBusLineNodeIds.length === 0) {
            return
        }

        const segments = this.segmentOptionsForTargetNode(targetNodeId)
        if (segments.length === 0) {
            return
        }

        if (segments.length === 1) {
            await this.placeBusLineSegment(segments[0])
            return
        }

        this.pendingBusLineTargetNodeId = targetNodeId
    }

    async confirmBusLineSourceNode(sourceNodeId: BusNodeId) {
        const targetNodeId = this.pendingBusLineTargetNodeId
        if (!targetNodeId) {
            return
        }

        const segment = this.segmentForSourceAndTargetNode(sourceNodeId, targetNodeId)
        if (!segment) {
            return
        }

        this.pendingBusLineTargetNodeId = undefined
        await this.placeBusLineSegment(segment)
    }

}
