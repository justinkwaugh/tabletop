import { GameSession } from '@tabletop/frontend-components'
import { uiBgColorForPlayer } from '$lib/utils/playerColors'
import yellowHut from '$lib/images/yellowhut.png'
import yellowHut2 from '$lib/images/yellowhut2.png'
import blueHut from '$lib/images/bluehut.png'
import blueHut2 from '$lib/images/bluehut2.png'
import greenHut from '$lib/images/greenhut.png'
import greenHut2 from '$lib/images/greenhut2.png'
import redHut from '$lib/images/redhut.png'
import redHut2 from '$lib/images/redhut2.png'

import {
    ActionType,
    HutType,
    HydratedKaivaiGameState,
    KaivaiGameState,
    PlaceBid,
    Build,
    HydratedBuild,
    MachineState,
    HydratedFish,
    Fish,
    HydratedDeliver,
    Deliver,
    Delivery,
    Celebrate,
    Increase
} from '@tabletop/kaivai'
import {
    axialCoordinatesToNumber,
    PlayerColor,
    sameCoordinates,
    type AxialCoordinates
} from '@tabletop/common'

export class KaivaiGameSession extends GameSession {
    get gameState(): HydratedKaivaiGameState {
        return new HydratedKaivaiGameState(this.visibleGameState as KaivaiGameState)
    }

    highlightedHexes: Set<number> = $state(new Set())

    chosenAction: string | undefined = $state(undefined)
    chosenBoat: string | undefined = $state(undefined)
    chosenHutType: HutType | undefined = $state(undefined)
    chosenBoatLocation: AxialCoordinates | undefined = $state(undefined)
    chosenDeliveries: Delivery[] = $state([])
    currentDeliveryLocation: AxialCoordinates | undefined = $state(undefined)

    myPlayerState = $derived.by(() =>
        this.gameState.players.find((p) => p.playerId === this.myPlayer?.id)
    )
    myTurnCount = $derived.by(() => {
        if (!this.myPlayer?.id) {
            return 0
        }
        return this.gameState.turnManager.turnCount(this.myPlayer.id)
    })

    usableBoats: string[] = $derived.by(() => {
        const playerState = this.myPlayerState
        if (!playerState) {
            return []
        }

        if (this.chosenAction === ActionType.Build) {
            return playerState.availableBoats.filter((boatId) => {
                return HydratedBuild.canBoatBuild({
                    gameState: this.gameState,
                    playerState,
                    boatId
                })
            })
        } else if (this.chosenAction === ActionType.Fish) {
            return playerState.availableBoats.filter((boatId) => {
                return HydratedFish.canBoatFish({
                    gameState: this.gameState,
                    playerState,
                    boatId
                })
            })
        } else if (this.chosenAction === ActionType.Deliver) {
            return playerState.availableBoats.filter((boatId) => {
                return HydratedDeliver.canBoatDeliver({
                    gameState: this.gameState,
                    playerState,
                    boatId
                })
            })
        }
        return []
    })

    validBoatLocationIds: Set<number> = $derived.by(() => {
        if (!this.chosenBoat) {
            return new Set()
        }

        const playerState = this.myPlayerState
        if (!playerState) {
            return new Set()
        }

        if (this.chosenAction === ActionType.Build) {
            return new Set(
                HydratedBuild.validBoatLocations({
                    gameState: this.gameState,
                    playerState: playerState,
                    boatId: this.chosenBoat
                }).map((coords) => axialCoordinatesToNumber(coords))
            )
        } else if (this.chosenAction === ActionType.Fish) {
            return new Set(
                HydratedFish.validBoatLocations({
                    gameState: this.gameState,
                    playerState: playerState,
                    boatId: this.chosenBoat
                }).map((coords) => axialCoordinatesToNumber(coords))
            )
        } else if (this.chosenAction === ActionType.Deliver) {
            return new Set(
                HydratedDeliver.validBoatLocations({
                    gameState: this.gameState,
                    playerState: playerState,
                    boatId: this.chosenBoat
                }).map((coords) => axialCoordinatesToNumber(coords))
            )
        }
        return new Set()
    })

    // Why is this slower combined with the cell interactable check?
    // This method takes only 5 ms to run.

    validBuildLocationIds: number[] = $derived.by(() => {
        if (this.chosenAction !== ActionType.Build || !this.chosenBoatLocation) {
            return []
        }

        const playerState = this.myPlayerState
        if (!playerState) {
            return []
        }

        if (
            this.chosenAction === ActionType.Build &&
            this.gameState.machineState === MachineState.TakingActions &&
            this.chosenHutType
        ) {
            const neighbors = this.gameState.board.getNeighbors(this.chosenBoatLocation)
            return neighbors
                .filter((coords) => {
                    const { valid } = HydratedBuild.isValidPlacement(this.gameState, {
                        playerId: playerState.playerId,
                        hutType: this.chosenHutType!,
                        coords,
                        boatCoords: this.chosenBoatLocation
                    })
                    return valid
                })
                .map((coords) => axialCoordinatesToNumber(coords))
        }

        return []
    })

    validDeliveryLocationIds: number[] = $derived.by(() => {
        if (this.chosenAction !== ActionType.Deliver || !this.chosenBoatLocation) {
            return []
        }

        const playerState = this.myPlayerState
        if (!playerState) {
            return []
        }

        const deliveredFish = this.chosenDeliveries.reduce((sum, d) => sum + d.amount, 0)
        if (deliveredFish === playerState.numFish()) {
            return []
        }

        return this.gameState.board
            .getDeliverableNeighbors(this.chosenBoatLocation)
            .filter((cell) => {
                const delivery = this.chosenDeliveries.find((d) => {
                    return sameCoordinates(d.coords, cell.coords)
                })
                return !delivery || cell.fish + delivery.amount <= 3
            })
            .map((cell) => axialCoordinatesToNumber(cell.coords))
    })

    validCelebrationIslands: Set<string> = $derived.by(() => {
        if (this.chosenAction !== ActionType.Celebrate) {
            return new Set()
        }

        const islandIds = new Set<string>()
        for (const cell of this.gameState.board.getCelebratableCells()) {
            islandIds.add(cell.islandId)
        }
        console.log('valid islands', islandIds)

        return islandIds
    })

    getPlayerBgColor(playerId?: string) {
        return uiBgColorForPlayer(this.getPlayerColor(playerId)) ?? 'bg-gray-500'
    }

    getPlayerTextColor(playerId?: string) {
        return this.getPlayerColor(playerId) === 'yellow' ? 'text-black' : 'text-gray-100'
    }

    getHutImage(hutType: HutType, playerId?: string) {
        const color = this.getPlayerColor(playerId)
        switch (hutType) {
            case HutType.Meeting:
                switch (color) {
                    case PlayerColor.Yellow:
                        return yellowHut2
                    case PlayerColor.Blue:
                        return blueHut2
                    case PlayerColor.Green:
                        return greenHut2
                    case PlayerColor.Red:
                        return redHut2
                }
                break
            case HutType.BoatBuilding:
            case HutType.Fishing:
                switch (color) {
                    case PlayerColor.Yellow:
                        return yellowHut
                    case PlayerColor.Blue:
                        return blueHut
                    case PlayerColor.Green:
                        return greenHut
                    case PlayerColor.Red:
                        return redHut
                }
                break
        }
    }

    cancel() {
        if (this.chosenHutType) {
            this.chosenHutType = undefined
        } else if (this.currentDeliveryLocation) {
            this.currentDeliveryLocation = undefined
        } else if (this.chosenDeliveries.length > 0) {
            this.chosenDeliveries = []
            this.chosenBoatLocation = undefined
        } else if (this.chosenBoatLocation) {
            this.chosenBoatLocation = undefined
        } else if (this.chosenBoat) {
            this.chosenBoat = undefined
        } else {
            this.chosenAction = undefined
        }
    }

    resetAction() {
        this.chosenAction = undefined
        this.chosenHutType = undefined
        this.chosenBoat = undefined
        this.chosenBoatLocation = undefined
        this.chosenDeliveries = []
        this.currentDeliveryLocation = undefined
    }

    setDelivery(amount: number) {
        if (!this.currentDeliveryLocation) {
            return
        }

        const coords = this.currentDeliveryLocation
        const existingIndex = this.chosenDeliveries.findIndex((d) =>
            sameCoordinates(d.coords, coords)
        )
        if (existingIndex !== -1) {
            this.chosenDeliveries[existingIndex].amount = amount
        } else {
            this.chosenDeliveries.push({ coords, amount })
        }

        this.currentDeliveryLocation = undefined
    }

    createPlaceBidAction(bid: number): PlaceBid {
        return { ...this.createBaseAction(ActionType.PlaceBid), amount: bid } as PlaceBid
    }

    createBuildAction({
        coords,
        hutType,
        boatId,
        boatCoords
    }: {
        coords: AxialCoordinates
        hutType: HutType
        boatId?: string
        boatCoords?: AxialCoordinates
    }): Build {
        return {
            ...this.createBaseAction(ActionType.Build),
            coords,
            hutType,
            boatId,
            boatCoords: $state.snapshot(boatCoords)
        } as Build
    }

    createFishAction({
        coords,
        boatId,
        boatCoords
    }: {
        coords: AxialCoordinates
        boatId: string
        boatCoords: AxialCoordinates
    }): Fish {
        return {
            ...this.createBaseAction(ActionType.Fish),
            coords,
            boatId,
            boatCoords: $state.snapshot(boatCoords)
        } as Fish
    }

    createDeliverAction({
        boatId,
        boatCoords,
        deliveries
    }: {
        boatId: string
        boatCoords: AxialCoordinates
        deliveries: Delivery[]
    }): Deliver {
        return {
            ...this.createBaseAction(ActionType.Deliver),
            boatId,
            boatCoords,
            deliveries
        } as Deliver
    }

    createIncreaseAction(): Increase {
        return { ...(this.createBaseAction(ActionType.Increase) as Increase) }
    }

    createCelebrateAction(islandId: string): Celebrate {
        return { ...(this.createBaseAction(ActionType.Celebrate) as Celebrate), islandId }
    }

    createMoveGodAction(coords: AxialCoordinates) {
        return { ...this.createBaseAction(ActionType.MoveGod), coords }
    }
}
