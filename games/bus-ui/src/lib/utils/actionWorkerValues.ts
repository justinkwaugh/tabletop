import { WorkerActionType, type HydratedBusGameState } from '@tabletop/bus'

export function resolvePlacedActionValue({
    state,
    actionType,
    selectionIndex,
    playerId,
    myPlayerId
}: {
    state: HydratedBusGameState
    actionType: WorkerActionType
    selectionIndex: number
    playerId: string
    myPlayerId?: string
}): number | undefined {
    const currentMaxBusValue = state.players.reduce((max, playerState) => {
        return Math.max(max, playerState.buses)
    }, 0)
    const busesActionPlayerState = state.players.find(
        (playerState) => playerState.playerId === state.busAction
    )
    const busesActionIncreasesMax =
        busesActionPlayerState !== undefined && busesActionPlayerState.buses + 1 > currentMaxBusValue

    const projectedPassengerAndBuildingBase =
        state.roundStartMaxBusValue + (busesActionIncreasesMax ? 1 : 0)
    const effectivePassengerAndBuildingBase = Math.max(
        projectedPassengerAndBuildingBase,
        state.maxBusValue()
    )
    const phase4AvailableSiteCap =
        state.currentBuildingPhase === 4
            ? state.board.openSitesForPhase(4).length
            : Number.POSITIVE_INFINITY

    const playerBusValues = new Map<string, number>(
        state.players.map((playerState) => [playerState.playerId, playerState.buses])
    )
    const playerStickValues = new Map<string, number>(
        state.players.map((playerState) => [playerState.playerId, playerState.sticks])
    )
    const lineExpansionBaseValue =
        state.roundStartMaxBusValue + (state.players.length === 5 ? 1 : 0)

    const expansionValuesBySelectionIndex = (() => {
        const values = new Map<number, number>()
        const remainingSticksByPlayer = new Map<string, number>(playerStickValues)

        for (
            let resolvedSelectionIndex = state.lineExpansionAction.length - 1;
            resolvedSelectionIndex >= 0;
            resolvedSelectionIndex -= 1
        ) {
            const resolvedPlayerId = state.lineExpansionAction[resolvedSelectionIndex]
            if (!resolvedPlayerId) {
                continue
            }

            const baseValue = Math.max(0, lineExpansionBaseValue - resolvedSelectionIndex)
            const remainingSticks = Math.max(
                0,
                remainingSticksByPlayer.get(resolvedPlayerId) ?? 0
            )
            const value = Math.min(baseValue, remainingSticks)

            values.set(resolvedSelectionIndex, value)
            remainingSticksByPlayer.set(
                resolvedPlayerId,
                Math.max(0, remainingSticks - value)
            )
        }

        return values
    })()

    const buildingValuesBySelectionIndex = (() => {
        const values = new Map<number, number>()
        let remainingSites = phase4AvailableSiteCap

        for (
            let resolvedSelectionIndex = state.buildingAction.length - 1;
            resolvedSelectionIndex >= 0;
            resolvedSelectionIndex -= 1
        ) {
            const resolvedPlayerId = state.buildingAction[resolvedSelectionIndex]
            if (!resolvedPlayerId) {
                continue
            }

            const baseValue = Math.max(
                0,
                effectivePassengerAndBuildingBase - resolvedSelectionIndex
            )
            const value = Math.min(baseValue, remainingSites)

            values.set(resolvedSelectionIndex, value)
            remainingSites = Math.max(0, remainingSites - value)
        }

        return values
    })()

    switch (actionType) {
        case WorkerActionType.Expansion:
            return expansionValuesBySelectionIndex.get(selectionIndex) ?? 0
        case WorkerActionType.Passengers: {
            let remainingPassengers = state.passengers.length

            for (
                let resolvedSelectionIndex = 0;
                resolvedSelectionIndex <= selectionIndex;
                resolvedSelectionIndex += 1
            ) {
                const resolvedPlayerId = state.passengersAction[resolvedSelectionIndex]
                if (!resolvedPlayerId) {
                    continue
                }

                const baseValue = Math.max(
                    0,
                    effectivePassengerAndBuildingBase - resolvedSelectionIndex
                )
                const value = Math.min(baseValue, remainingPassengers)

                if (resolvedSelectionIndex === selectionIndex) {
                    return value
                }

                remainingPassengers = Math.max(0, remainingPassengers - value)
            }

            return 0
        }
        case WorkerActionType.Buildings:
            return buildingValuesBySelectionIndex.get(selectionIndex) ?? 0
        case WorkerActionType.Vroom: {
            const effectivePlayerId = playerId ?? myPlayerId
            if (!effectivePlayerId) {
                return undefined
            }
            const baseBusValue = playerBusValues.get(effectivePlayerId) ?? 0
            const playerGetsBusBonus = state.busAction === effectivePlayerId
            return Math.max(0, baseBusValue + (playerGetsBusBonus ? 1 : 0))
        }
        default:
            return undefined
    }
}
