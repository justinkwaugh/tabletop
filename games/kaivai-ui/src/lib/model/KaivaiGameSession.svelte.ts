import { AnimationContext, GameSession } from '@tabletop/frontend-components'
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
    HydratedKaivaiGameState,
    MoveGod,
    Sacrifice
} from '@tabletop/kaivai'
import {
    coordinatesToNumber,
    GameAction,
    Color,
    sameCoordinates,
    type AxialCoordinates
} from '@tabletop/common'

export class KaivaiGameSession extends GameSession<KaivaiGameState, HydratedKaivaiGameState> {
    highlightedHexes: Set<number> = $state(new Set())

    chosenAction: string | undefined = $state(undefined)
    chosenBoat: string | undefined = $state(undefined)
    chosenHutType: HutType | undefined = $state(undefined)
    chosenBoatLocation: AxialCoordinates | undefined = $state(undefined)
    chosenDeliveries: Delivery[] = $state([])
    currentDeliveryLocation: AxialCoordinates | undefined = $state(undefined)

    // Not really needed now
    lastAction = $derived(this.currentAction)

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
                }).map((coords) => coordinatesToNumber(coords))
            )
        } else if (this.chosenAction === ActionType.Fish) {
            return new Set(
                HydratedFish.validBoatLocations({
                    gameState: this.gameState,
                    playerState: playerState,
                    boatId: this.chosenBoat
                }).map((coords) => coordinatesToNumber(coords))
            )
        } else if (this.chosenAction === ActionType.Deliver) {
            return new Set(
                HydratedDeliver.validBoatLocations({
                    gameState: this.gameState,
                    playerState: playerState,
                    boatId: this.chosenBoat
                }).map((coords) => coordinatesToNumber(coords))
            )
        } else if (this.chosenAction === ActionType.Move) {
            return new Set(
                HydratedMove.validBoatLocations({
                    gameState: this.gameState,
                    playerState: playerState,
                    boatId: this.chosenBoat
                }).map((coords) => coordinatesToNumber(coords))
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
    //                 .map((coords) => coordinatesToNumber(coords))
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
            .map((cell) => coordinatesToNumber(cell.coords))
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

    override async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedKaivaiGameState
        from?: HydratedKaivaiGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        this.resetAction()
    }

    getPlayerSvgColor(playerId?: string) {
        return this.colors.getPlayerColor(playerId) === 'yellow' ? 'black' : 'white'
    }

    getHutImage(hutType: HutType, playerId?: string) {
        const color = this.colors.getPlayerColor(playerId)
        switch (hutType) {
            case HutType.Meeting:
                switch (color) {
                    case Color.Yellow:
                        return this.colors.colorBlind ? yellowHut2Cb : yellowHut2
                    case Color.Blue:
                        return this.colors.colorBlind ? blueHut2Cb : blueHut2
                    case Color.Green:
                        return this.colors.colorBlind ? greenHut2Cb : greenHut2
                    case Color.Red:
                        return this.colors.colorBlind ? redHut2Cb : redHut2
                }
                break
            case HutType.BoatBuilding:
            case HutType.Fishing:
                switch (color) {
                    case Color.Yellow:
                        return this.colors.colorBlind ? yellowHutCb : yellowHut
                    case Color.Blue:
                        return this.colors.colorBlind ? blueHutCb : blueHut
                    case Color.Green:
                        return this.colors.colorBlind ? greenHutCb : greenHut
                    case Color.Red:
                        return this.colors.colorBlind ? redHutCb : redHut
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

        this.chosenDeliveries = []
        this.currentDeliveryLocation = undefined

        // These break the boat animations if not delayed.
        // Not sure if svelte bug or not.
        setTimeout(() => {
            this.chosenBoat = undefined
            this.chosenBoatLocation = undefined
        })
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
        return this.createPlayerAction(PlaceBid, { amount: bid })
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
        return this.createPlayerAction(Build, {
            coords,
            hutType,
            boatId,
            boatCoords: $state.snapshot(boatCoords)
        })
    }

    createFishAction({
        boatId,
        boatCoords
    }: {
        boatId: string
        boatCoords: AxialCoordinates
    }): Fish {
        return this.createPlayerAction(Fish, {
            boatId,
            boatCoords: $state.snapshot(boatCoords),
            revealsInfo: !this.game.config.lucklessFishing
        })
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
        return this.createPlayerAction(Deliver, {
            boatId,
            boatCoords,
            deliveries
        })
    }

    createMoveAction({
        boatId,
        boatCoords
    }: {
        boatId: string
        boatCoords: AxialCoordinates
    }): Move {
        return this.createPlayerAction(Move, {
            boatId,
            boatCoords: $state.snapshot(boatCoords)
        })
    }

    createIncreaseAction(): Increase {
        return this.createPlayerAction(Increase)
    }

    createCelebrateAction(islandId: string): Celebrate {
        return this.createPlayerAction(Celebrate, { islandId })
    }

    createMoveGodAction(coords: AxialCoordinates) {
        return this.createPlayerAction(MoveGod, { coords })
    }

    createPassAction(): Pass {
        return this.createPlayerAction(Pass)
    }

    createSacrificeAction(): Sacrifice {
        return this.createPlayerAction(Sacrifice)
    }

    createChooseScoringIslandAction(islandId: string): ChooseScoringIsland {
        return this.createPlayerAction(ChooseScoringIsland, { islandId })
    }

    createPlaceScoringBidAction(bid: number): PlaceScoringBid {
        return this.createPlayerAction(PlaceScoringBid, {
            amount: bid,
            simultaneousGroupId: `bid-${this.gameState.chosenIsland}`
        })
    }

    override shouldAutoStepAction(action: GameAction) {
        return (
            action.type === ActionType.PlaceScoringBid ||
            action.type === ActionType.ChooseScoringIsland ||
            (isPass(action) && action.metadata?.reason !== PassReason.DoneActions)
        )
    }
}
