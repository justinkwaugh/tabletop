<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { Hex } from 'honeycomb-grid'
    import cultTile from '$lib/images/culttile.png'
    import { axialCoordinatesToNumber, sameCoordinates, Point } from '@tabletop/common'
    import {
        ActionType,
        CellType,
        HydratedBuild,
        HutType,
        HydratedMoveGod,
        MachineState
    } from '@tabletop/kaivai'

    let gameSession = getContext('gameSession') as KaivaiGameSession
    let { hex, origin }: { hex: Hex; origin: Point } = $props()
    let cell = $derived(gameSession.gameState.board.cells[axialCoordinatesToNumber(hex)])
    let cellImage = $derived.by(() => {
        if (cell) {
            switch (cell.type) {
                case CellType.Cult:
                    return cultTile
                case CellType.Meeting:
                    return gameSession.getHutImage(HutType.Meeting, cell.owner)
                case CellType.Fishing:
                    return gameSession.getHutImage(HutType.Fishing, cell.owner)
                case CellType.BoatBuilding:
                    return gameSession.getHutImage(HutType.BoatBuilding, cell.owner)
                case CellType.Water:
                default:
                    return undefined
            }
        }
        return undefined
    })

    let cellText = $derived.by(() => {
        const boat = getBoat()
        if ((boat && !boatWasMoved()) || isTargetBoatLocation()) {
            return 'BOAT'
        }

        if (cell) {
            if (cell.type === CellType.Fishing) {
                return 'FISHMAN'
            }
            if (
                gameSession.gameState.godLocation?.coords.q === hex.q &&
                gameSession.gameState.godLocation?.coords.r === hex.r
            ) {
                return 'GOD'
            }
        }
        return undefined
    })

    function boatWasMoved() {
        const boat = getBoat()
        return (
            boat &&
            gameSession.chosenBoat === boat.id &&
            gameSession.chosenBoatLocation &&
            !sameCoordinates(hex, gameSession.chosenBoatLocation)
        )
    }

    function isTargetBoatLocation() {
        return sameCoordinates(hex, gameSession.chosenBoatLocation)
    }

    let interacting = $derived.by(() => {
        if (gameSession.chosenAction === ActionType.Build) {
            if (
                gameSession.gameState.machineState === MachineState.InitialHuts &&
                gameSession.chosenHutType
            ) {
                return true
            } else if (
                ((gameSession.gameState.machineState === MachineState.TakingActions ||
                    gameSession.gameState.machineState === MachineState.Building) &&
                    !gameSession.chosenBoatLocation) ||
                gameSession.chosenHutType
            ) {
                return true
            }
        } else if (gameSession.chosenAction === ActionType.Fish) {
            return true
        } else if (gameSession.chosenAction === ActionType.Deliver) {
            return true
        } else if (gameSession.chosenAction === ActionType.MoveGod) {
            return true
        }
        return false
    })

    let interactable = $derived.by(() => {
        if (!gameSession.isMyTurn || !gameSession.myPlayer?.id) {
            return false
        }

        if (
            gameSession.chosenAction === ActionType.Build &&
            (gameSession.gameState.machineState === MachineState.TakingActions ||
                gameSession.gameState.machineState === MachineState.Building)
        ) {
            return isInteractableForBuild()
        } else if (
            gameSession.chosenAction === ActionType.Build &&
            gameSession.gameState.machineState === MachineState.InitialHuts
        ) {
            return isInteractiableForInitialHutsBuild()
        } else if (gameSession.chosenAction === ActionType.Fish) {
            return isInteractableForFish()
        } else if (gameSession.chosenAction === ActionType.Deliver) {
            return isInteractableForDeliver()
        } else if (gameSession.chosenAction === ActionType.MoveGod) {
            return isInteractableForMoveGod()
        }
        return false
    })

    function isInteractableForBuild(): boolean {
        if (!gameSession.chosenBoat) {
            const boat = getBoat()
            return boat !== undefined && gameSession.usableBoats.includes(boat.id)
        } else if (!gameSession.chosenBoatLocation) {
            return gameSession.validBoatLocationIds.has(axialCoordinatesToNumber(hex))
        } else if (gameSession.chosenHutType) {
            // Why is checking every cell faster than using the validBuildLocationIds set?
            const { valid } = HydratedBuild.isValidPlacement(gameSession.gameState, {
                playerId: gameSession.myPlayer!.id,
                hutType: gameSession.chosenHutType!,
                coords: hex,
                boatCoords: gameSession.chosenBoatLocation
            })
            return valid
            // return gameSession.validBuildLocationIds.includes(axialCoordinatesToNumber(hex))
        }
        return false
    }

    function isInteractiableForInitialHutsBuild(): boolean {
        if (!gameSession.myPlayer?.id) {
            return false
        }

        if (gameSession.chosenHutType) {
            const { valid, reason } = HydratedBuild.isValidPlacement(gameSession.gameState, {
                playerId: gameSession.myPlayer.id,
                hutType: gameSession.chosenHutType,
                coords: { q: hex.q, r: hex.r }
            })
            return valid
        }
        return false
    }

    function isInteractableForFish(): boolean {
        if (!gameSession.chosenBoat) {
            const boat = getBoat()
            return boat !== undefined && gameSession.usableBoats.includes(boat.id)
        } else if (!gameSession.chosenBoatLocation) {
            return gameSession.validBoatLocationIds.has(axialCoordinatesToNumber(hex))
        }
        return false
    }

    function isInteractableForDeliver(): boolean {
        if (!gameSession.chosenBoat) {
            const boat = getBoat()
            return boat !== undefined && gameSession.usableBoats.includes(boat.id)
        } else if (!gameSession.chosenBoatLocation) {
            return gameSession.validBoatLocationIds.has(axialCoordinatesToNumber(hex))
        }
        return false
    }

    function isInteractableForMoveGod(): boolean {
        const { valid, reason } = HydratedMoveGod.isValidPlacement(gameSession.gameState, {
            q: hex.q,
            r: hex.r
        })
        return valid
    }

    let disabled = $derived.by(() => {
        if (gameSession.highlightedHexes.size > 0) {
            if (!gameSession.highlightedHexes.has(axialCoordinatesToNumber(hex))) {
                return true
            } else {
                return false
            }
        }
        return interacting && !interactable
    })

    async function build() {
        if (!gameSession.chosenHutType) {
            return
        }

        const action = gameSession.createBuildAction({
            coords: { q: hex.q, r: hex.r },
            hutType: gameSession.chosenHutType,
            boatId: gameSession.chosenBoat,
            boatCoords: gameSession.chosenBoatLocation
        })
        gameSession.applyAction(action)
        gameSession.resetAction()
    }

    async function fish() {
        if (!gameSession.chosenBoat || !gameSession.chosenBoatLocation) {
            return
        }

        const action = gameSession.createFishAction({
            coords: { q: hex.q, r: hex.r },
            boatId: gameSession.chosenBoat,
            boatCoords: gameSession.chosenBoatLocation
        })
        gameSession.applyAction(action)
        gameSession.resetAction()
    }

    async function moveGod() {
        const action = gameSession.createMoveGodAction({ q: hex.q, r: hex.r })
        gameSession.applyAction(action)
        gameSession.resetAction()
    }

    async function onClick() {
        if (!interactable) {
            return
        }

        if (gameSession.chosenAction === ActionType.Build) {
            if (
                gameSession.gameState.machineState === MachineState.TakingActions ||
                gameSession.gameState.machineState === MachineState.Building
            ) {
                if (!gameSession.chosenBoat) {
                    const boat = getBoat()
                    if (!boat) {
                        return
                    }
                    gameSession.chosenBoat = boat.id
                    return
                } else if (!gameSession.chosenBoatLocation) {
                    gameSession.chosenBoatLocation = { q: hex.q, r: hex.r }
                    return
                } else if (gameSession.chosenHutType) {
                    await build()
                    return
                }
            } else if (
                gameSession.gameState.machineState === MachineState.InitialHuts &&
                gameSession.chosenHutType
            ) {
                await build()
                return
            }
        } else if (gameSession.chosenAction === ActionType.Fish) {
            if (!gameSession.chosenBoat) {
                const boat = getBoat()
                if (!boat) {
                    return
                }
                gameSession.chosenBoat = boat.id
                return
            } else if (!gameSession.chosenBoatLocation) {
                gameSession.chosenBoatLocation = { q: hex.q, r: hex.r }
                await fish()
                return
            }
        } else if (gameSession.chosenAction === ActionType.Deliver) {
            if (!gameSession.chosenBoat) {
                const boat = getBoat()
                if (!boat) {
                    return
                }
                gameSession.chosenBoat = boat.id
                return
            } else if (!gameSession.chosenBoatLocation) {
                gameSession.chosenBoatLocation = { q: hex.q, r: hex.r }
                return
            }
        } else if (gameSession.chosenAction === ActionType.MoveGod) {
            await moveGod()
            return
        }
    }

    function getBoat() {
        if (!cell || (cell.type !== CellType.BoatBuilding && cell.type !== CellType.Water)) {
            return undefined
        }
        return cell.boat
    }
    let tabIndex = $derived(interactable ? 0 : -1)
</script>

<g
    role="button"
    onkeypress={() => onClick()}
    onclick={() => onClick()}
    pointer-events="visible"
    stroke="none"
    stroke-width="2"
    transform="translate({hex.x + origin.x}, {hex.y + origin.y})"
>
    <polygon points="25,-43.5 50,0 25,43.5 -25,43.5 -50,0 -25,-43.5" fill="none" opacity="1"
    ></polygon>
    {#if cellImage}
        <g transform="rotate(30)">
            <image
                href={cellImage}
                x={-hex.height / 2}
                y={-hex.width / 2}
                width={hex.height}
                height={hex.width}
            ></image>
        </g>
    {/if}
    {#if disabled}
        <polygon points="25,-43.5 50,0 25,43.5 -25,43.5 -50,0 -25,-43.5" fill="black" opacity="0.5"
        ></polygon>
    {/if}
    <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size="20" fill="black">
        {hex.q}, {hex.r}
    </text>
    {#if cellText}
        <text
            x="0"
            y="0"
            text-anchor="middle"
            dominant-baseline="middle"
            font-size="20"
            fill="white"
        >
            {cellText}
        </text>
    {/if}
</g>
