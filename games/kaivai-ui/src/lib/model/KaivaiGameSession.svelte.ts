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
    MachineState
} from '@tabletop/kaivai'
import { axialCoordinatesToNumber, PlayerColor, type AxialCoordinates } from '@tabletop/common'

export class KaivaiGameSession extends GameSession {
    get gameState(): HydratedKaivaiGameState {
        return new HydratedKaivaiGameState(this.visibleGameState as KaivaiGameState)
    }

    highlightedHexes: Set<number> = $state(new Set())

    chosenAction: string | undefined = $state(undefined)
    chosenBoat: string | undefined = $state(undefined)
    chosenHutType: HutType | undefined = $state(undefined)
    chosenBoatLocation: AxialCoordinates | undefined = $state(undefined)

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
            return Object.keys(playerState.boatLocations).filter((boatId) => {
                return HydratedBuild.canBoatBuild({
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
                    const { valid } = HydratedBuild.isValidPlacement(
                        this.gameState,
                        {
                            playerId: playerState.playerId,
                            hutType: this.chosenHutType!,
                            coords,
                            boatCoords: this.chosenBoatLocation
                        },
                        true
                    )
                    return valid
                })
                .map((coords) => axialCoordinatesToNumber(coords))
        }

        return []
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

    createMoveGodAction(coords: AxialCoordinates) {
        return { ...this.createBaseAction(ActionType.MoveGod), coords }
    }
}
