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
        MachineState,
        isFishingCell,
        isBoatCell,
        isDeliveryCell,
        isIslandCell
    } from '@tabletop/kaivai'
    import { uiColorForPlayer } from '$lib/utils/playerColors'

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

    let hasFisherman = $derived(isFishingCell(cell))
    let hasBoat = $derived.by(() => {
        if (isBoatCell(cell) && cell.boat) {
            return (
                gameSession.chosenBoat !== cell.boat.id ||
                !gameSession.chosenBoatLocation ||
                sameCoordinates(gameSession.chosenBoatLocation, hex)
            )
        } else {
            return sameCoordinates(gameSession.chosenBoatLocation, hex)
        }
    })
    let hasGod = $derived(
        gameSession.gameState.godLocation?.coords.q === hex.q &&
            gameSession.gameState.godLocation?.coords.r === hex.r
    )
    let numFish = $derived.by(() => {
        const storedFish = isDeliveryCell(cell) ? cell.fish : 0
        const delivery = gameSession.chosenDeliveries.find((d) => sameCoordinates(d.coords, hex))
        return storedFish + (delivery?.amount ?? 0)
    })
    let hasFishToken = $derived(numFish > 0)

    let playerColor = $derived.by(() => {
        if (isBoatCell(cell) && cell.boat) {
            return uiColorForPlayer(gameSession.getPlayerColor(cell.boat.owner))
        } else if (isFishingCell(cell)) {
            return uiColorForPlayer(gameSession.getPlayerColor(cell.owner))
        } else {
            return uiColorForPlayer(gameSession.getPlayerColor(gameSession.myPlayer?.id))
        }
    })

    let interacting = $derived.by(() => {
        switch (gameSession.chosenAction) {
            case ActionType.Build: {
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
                break
            }
            case ActionType.Fish:
            case ActionType.Deliver:
            case ActionType.Move:
            case ActionType.Celebrate:
            case ActionType.MoveGod: {
                return true
            }
            default:
                return false
        }
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
        } else if (gameSession.chosenAction === ActionType.Move) {
            return isInteractableForMove()
        } else if (gameSession.chosenAction === ActionType.Celebrate) {
            return isInteractableForCelebrate()
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
        } else {
            return gameSession.validDeliveryLocationIds.includes(axialCoordinatesToNumber(hex))
        }
        return false
    }

    function isInteractableForMove(): boolean {
        if (!gameSession.chosenBoat) {
            const boat = getBoat()
            return boat !== undefined && gameSession.usableBoats.includes(boat.id)
        } else if (!gameSession.chosenBoatLocation) {
            return gameSession.validBoatLocationIds.has(axialCoordinatesToNumber(hex))
        }
        return false
    }

    function isInteractableForCelebrate(): boolean {
        if (!isIslandCell(cell)) {
            return false
        }
        return gameSession.validCelebrationIslands.has(cell?.islandId)
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
            boatId: gameSession.chosenBoat,
            boatCoords: gameSession.chosenBoatLocation
        })
        gameSession.applyAction(action)
        gameSession.resetAction()
    }

    async function move() {
        if (!gameSession.chosenBoat || !gameSession.chosenBoatLocation) {
            return
        }

        const action = gameSession.createMoveAction({
            boatId: gameSession.chosenBoat,
            boatCoords: gameSession.chosenBoatLocation
        })
        gameSession.applyAction(action)
        gameSession.resetAction()
    }

    async function celebrate() {
        if (!isIslandCell(cell)) {
            return
        }
        const action = gameSession.createCelebrateAction(cell.islandId)
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
            } else if (!gameSession.currentDeliveryLocation) {
                gameSession.currentDeliveryLocation = { q: hex.q, r: hex.r }
                return
            }
        } else if (gameSession.chosenAction === ActionType.Move) {
            if (!gameSession.chosenBoat) {
                const boat = getBoat()
                if (!boat) {
                    return
                }
                gameSession.chosenBoat = boat.id
                return
            } else if (!gameSession.chosenBoatLocation) {
                gameSession.chosenBoatLocation = { q: hex.q, r: hex.r }
                await move()
                return
            }
        } else if (gameSession.chosenAction === ActionType.Celebrate) {
            await celebrate()
            return
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

    <!-- <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size="30" fill="yellow">
        {hex.q}, {hex.r}
    </text> -->
    {#if hasFisherman}
        <svg
            width="87px"
            height="100px"
            x={-43.5}
            y={-50}
            viewBox="-9.5 -5 31 31"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            ><path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M2.88138 8.90846C1.73464 7.99226 1 6.58192 1 5C1 2.23858 3.23858 0 6 0C8.7614 0 11 2.23858 11 5C11 6.5814 10.2658 7.99133 9.1198 8.90755L11.0777 13.8831C11.6866 15.4306 12.0015 17.1081 12.0015 18.8049V21C12.0015 21.5523 11.5538 22 11.0015 22H1C0.44772 22 0 21.5523 0 21L0 18.8049C0 17.1081 0.31487 15.4306 0.92382 13.8831L2.88138 8.90846z"
                fill={playerColor}
                stroke="#000000"
                stroke-width="1"
            ></path></svg
        >
    {/if}
    {#if hasBoat}
        <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            width="60px"
            height="60px"
            x={-30}
            y={-30}
            viewBox="0 0 512 512"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            fill={playerColor}
            stroke="#000000"
            stroke-width="15"
        >
            <path
                d="M333.5,31.6c0-6.2-4.7-24.2-24.8-19.9C114.5,53.5,81.8,257.9,76.3,323.4h257.3V31.6z"
            ></path>
            <path
                d="M19.7,364.3L94.6,491c3.7,6.2,10.4,10,17.6,10h287.7c7.2,0,13.9-3.8,17.6-10l74.9-126.7H19.7z"
            ></path>
        </svg>
    {/if}

    {#if hasGod}
        <svg
            fill="#000000"
            x={-30}
            y={-30}
            width="60px"
            height="60px"
            viewBox="0 0 32 32"
            version="1.1"
            stroke="#FFFFFF"
            stroke-width="1"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M12.746 0.911c-1.461 0.325-2.908 0.777-4.264 1.46 0.031 1.197 0.108 2.344 0.265 3.51-0.527 0.337-1.080 0.627-1.571 1.021-0.5 0.384-1.011 0.752-1.463 1.201-0.904-0.597-1.862-1.159-2.847-1.655-1.063 1.143-2.056 2.376-2.867 3.758 0.611 0.988 1.248 1.914 1.936 2.792h0.019v8.475c0.016 0 0.031 0 0.047 0.004l5.195 0.501c0.272 0.027 0.485 0.245 0.504 0.519l0.16 2.293 4.533 0.323 0.312-2.116c0.040-0.275 0.276-0.477 0.553-0.477h5.482c0.277 0 0.513 0.203 0.553 0.477l0.312 2.116 4.532-0.323 0.16-2.293c0.019-0.273 0.232-0.492 0.502-0.519l0.002-0 5.194-0.501c0.016 0 0.031-0.004 0.047-0.004v-0.676h0.003v-7.798h0.019c0.688-0.879 1.325-1.804 1.936-2.792-0.811-1.381-1.805-2.615-2.868-3.759-0.985 0.496-1.943 1.057-2.847 1.655-0.452-0.449-0.961-0.817-1.461-1.201-0.492-0.395-1.045-0.684-1.571-1.021 0.156-1.165 0.233-2.312 0.265-3.51-1.356-0.683-2.802-1.135-4.264-1.46-0.584 0.981-1.117 2.044-1.583 3.083-0.552-0.092-1.105-0.125-1.661-0.132h-0.021c-0.556 0.007-1.109 0.040-1.661 0.132-0.465-1.039-0.999-2.101-1.584-3.083l0.001-0.001zM8.635 13.319c1.729 0 3.132 1.401 3.132 3.131s-1.403 3.131-3.132 3.131c-1.728 0-3.131-1.401-3.131-3.131s1.401-3.131 3.131-3.131zM23.367 13.319c1.728 0 3.131 1.401 3.131 3.131s-1.401 3.131-3.131 3.131-3.132-1.401-3.132-3.131c0-1.729 1.401-3.131 3.132-3.131zM8.935 14.559c-1.148 0-2.079 0.931-2.079 2.079s0.931 2.078 2.079 2.078c1.148 0 2.079-0.931 2.079-2.078s-0.929-2.079-2.079-2.079zM23.066 14.559c-1.148 0-2.078 0.931-2.078 2.079s0.929 2.078 2.077 2.078c1.148 0 2.079-0.931 2.079-2.078s-0.929-2.079-2.079-2.079zM16.001 15.163c0.556 0 1.009 0.411 1.009 0.916v2.883c0 0.505-0.452 0.916-1.009 0.916s-1.008-0.411-1.008-0.916v-2.883c0-0.505 0.452-0.916 1.008-0.916zM1.947 22.595c0.003 0.503 0.008 1.052 0.008 1.161 0 4.935 6.259 7.306 14.036 7.334h0.019c7.777-0.027 14.035-2.399 14.035-7.334 0-0.112 0.007-0.66 0.009-1.161l-4.67 0.451-0.161 2.305c-0.020 0.278-0.241 0.499-0.517 0.52l-0.002 0-5.575 0.395c-0.28-0-0.512-0.206-0.553-0.474l-0-0.003-0.317-2.152h-4.515l-0.317 2.152c-0.041 0.272-0.273 0.477-0.553 0.477-0.014 0-0.028-0.001-0.042-0.002l0.002 0-5.535-0.395c-0.277-0.020-0.5-0.241-0.519-0.519l-0.16-2.306-4.673-0.449z"
            ></path>
        </svg>
    {/if}

    {#if hasFishToken}
        <!-- <image href={fishtoken} x={-25} y={-25} width="50px" height="50px"></image>
        <circle cx="0" cy="0" r="25" fill="black" stroke="black" opacity=".1" stroke-width="2"
        ></circle> -->
        <text
            class="kaivai-font"
            style="filter: url(#textshadow); fill: black"
            x="-4"
            y="0"
            text-anchor="end"
            dominant-baseline="middle"
            font-size="50"
            font-weight="bold"
            stroke-width="1"
            stroke="#000000"
            opacity=".5"
            fill="black">{numFish}</text
        >
        <text
            class="kaivai-font"
            x="-4"
            y="5"
            text-anchor="end"
            dominant-baseline="middle"
            font-size="50"
            font-weight="bold"
            stroke-width="1"
            stroke="#FFFFFF"
            fill="white"
            >{numFish}
        </text>

        <g transform="rotate(90)">
            <svg
                x={-19}
                y={-33}
                height="38px"
                width="38px"
                version="1.1"
                id="_x32_"
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                viewBox="0 0 512 512"
                xml:space="preserve"
                filter="url(#dropshadow)"
                fill="#FFFFFF"
            >
                <g>
                    <path
                        class="st0"
                        d="M508.727,159.883c-14.908-8.942-74.31,45.732-91.456,68.595c-57.163-34.302-108.602-57.164-108.602-57.164
		s22.862-100.025-8.578-94.318c-28.638,5.212-81.664,42.558-125.749,77.172C100.033,174.176,10.164,225.086,0,274.201
		c28.577,94.318,191.489,140.042,288.66,160.05c47.831,9.852,20.009-57.155,20.009-57.155s51.439-22.87,108.602-57.163
		c17.147,22.862,76.548,77.536,91.456,68.594c14.293-8.577-22.862-114.326-22.862-114.326S523.02,168.461,508.727,159.883z"
                    ></path>
                </g>
            </svg>
        </g>
    {/if}

    {#if disabled}
        <polygon points="25,-43.5 50,0 25,43.5 -25,43.5 -50,0 -25,-43.5" fill="black" opacity="0.5"
        ></polygon>
    {/if}
</g>
