import { GameSession } from '@tabletop/frontend-components'
import yellowHut from '$lib/images/yellowhut.png'
import yellowHut2 from '$lib/images/yellowhut2.png'
import blueHut from '$lib/images/bluehut.png'
import blueHut2 from '$lib/images/bluehut2.png'
import greenHut from '$lib/images/greenhut.png'
import greenHut2 from '$lib/images/greenhut2.png'
import redHut from '$lib/images/redhut.png'
import redHut2 from '$lib/images/redhut2.png'
import yellowHutCb from '$lib/images/yellowhut-cb.png'
import yellowHut2Cb from '$lib/images/yellowhut2-cb.png'
import blueHutCb from '$lib/images/bluehut-cb.png'
import blueHut2Cb from '$lib/images/bluehut2-cb.png'
import greenHutCb from '$lib/images/greenhut-cb.png'
import greenHut2Cb from '$lib/images/greenhut2-cb.png'
import redHutCb from '$lib/images/redhut-cb.png'
import redHut2Cb from '$lib/images/redhut2-cb.png'
import {
    ActionType,
    HutType,
    KaivaiGameState,
    PlaceBid,
    Build,
    HydratedBuild,
    HydratedFish,
    Fish,
    HydratedDeliver,
    Deliver,
    Delivery,
    Celebrate,
    Increase,
    HydratedMove,
    Move,
    Pass,
    ChooseScoringIsland,
    PlaceScoringBid,
    isPass,
    PassReason,
    HydratedKaivaiGameState
} from '@tabletop/kaivai'
import {
    axialCoordinatesToNumber,
    GameAction,
    Color,
    sameCoordinates,
    type AxialCoordinates,
    ActionSource
} from '@tabletop/common'

export class KaivaiGameSession extends GameSession<KaivaiGameState, HydratedKaivaiGameState> {
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
        } else if (this.chosenAction === ActionType.Move) {
            return playerState.availableBoats.filter((boatId) => {
                return HydratedMove.canBoatMove({
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
        } else if (this.chosenAction === ActionType.Move) {
            return new Set(
                HydratedMove.validBoatLocations({
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

    // validBuildLocationIds: Set<number> = $derived.by(() => {
    //     if (this.chosenAction !== ActionType.Build || !this.chosenBoatLocation) {
    //         return new Set()
    //     }

    //     const playerState = this.myPlayerState
    //     if (!playerState) {
    //         return new Set()
    //     }

    //     if (
    //         this.chosenAction === ActionType.Build &&
    //         this.gameState.machineState === MachineState.TakingActions &&
    //         this.chosenHutType
    //     ) {
    //         const neighbors = this.gameState.board.getNeighbors(this.chosenBoatLocation)
    //         return new Set(
    //             neighbors
    //                 .filter((coords) => {
    //                     const { valid } = HydratedBuild.isValidPlacement(this.gameState, {
    //                         playerId: playerState.playerId,
    //                         hutType: this.chosenHutType!,
    //                         coords,
    //                         boatCoords: this.chosenBoatLocation
    //                     })
    //                     return valid
    //                 })
    //                 .map((coords) => axialCoordinatesToNumber(coords))
    //         )
    //     }

    //     return new Set()
    // })

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
            .getDeliverableNeighbors(this.chosenBoatLocation, this.chosenBoat)
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

        return islandIds
    })

    getPlayerSvgColor(playerId?: string) {
        return this.getPlayerColor(playerId) === 'yellow' ? 'black' : 'white'
    }

    getHutImage(hutType: HutType, playerId?: string) {
        const color = this.getPlayerColor(playerId)
        switch (hutType) {
            case HutType.Meeting:
                switch (color) {
                    case Color.Yellow:
                        return this.colorBlind ? yellowHut2Cb : yellowHut2
                    case Color.Blue:
                        return this.colorBlind ? blueHut2Cb : blueHut2
                    case Color.Green:
                        return this.colorBlind ? greenHut2Cb : greenHut2
                    case Color.Red:
                        return this.colorBlind ? redHut2Cb : redHut2
                }
                break
            case HutType.BoatBuilding:
            case HutType.Fishing:
                switch (color) {
                    case Color.Yellow:
                        return this.colorBlind ? yellowHutCb : yellowHut
                    case Color.Blue:
                        return this.colorBlind ? blueHutCb : blueHut
                    case Color.Green:
                        return this.colorBlind ? greenHutCb : greenHut
                    case Color.Red:
                        return this.colorBlind ? redHutCb : redHut
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

    setDeliveryLocation(coords: AxialCoordinates) {
        this.currentDeliveryLocation = coords
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
        boatId,
        boatCoords
    }: {
        boatId: string
        boatCoords: AxialCoordinates
    }): Fish {
        return {
            ...this.createBaseAction(ActionType.Fish),
            boatId,
            boatCoords: $state.snapshot(boatCoords),
            revealsInfo: !this.game.config.lucklessFishing
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

    createMoveAction({
        boatId,
        boatCoords
    }: {
        boatId: string
        boatCoords: AxialCoordinates
    }): Move {
        return {
            ...this.createBaseAction(ActionType.Move),
            boatId,
            boatCoords: $state.snapshot(boatCoords)
        } as Move
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

    createPassAction(): Pass {
        return { ...this.createBaseAction(ActionType.Pass) } as Pass
    }

    createSacrificeAction(): Pass {
        return { ...this.createBaseAction(ActionType.Sacrifice) } as Pass
    }

    createChooseScoringIslandAction(islandId: string): ChooseScoringIsland {
        return {
            ...(this.createBaseAction(ActionType.ChooseScoringIsland) as ChooseScoringIsland),
            islandId
        }
    }

    createPlaceScoringBidAction(bid: number): PlaceScoringBid {
        return {
            ...this.createBaseAction(ActionType.PlaceScoringBid),
            amount: bid,
            simultaneousGroupId: `bid-${this.gameState.chosenIsland}`
        } as PlaceScoringBid
    }

    override shouldAutoStepAction(action: GameAction) {
        return (
            action.type === ActionType.PlaceScoringBid ||
            (action.type === ActionType.ChooseScoringIsland &&
                action.source === ActionSource.System) ||
            (isPass(action) && action.metadata?.reason !== PassReason.DoneActions)
        )
    }
}
