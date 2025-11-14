<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { Direction, Hex } from 'honeycomb-grid'
    import cultTile from '$lib/images/culttile.png'
    import fishtoken from '$lib/images/fishtoken.png'
    import FishGod from '$lib/images/fishgod.svelte'
    import { coordinatesToNumber, sameCoordinates, Point, Game } from '@tabletop/common'
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
        isIslandCell,
        isFish,
        isDeliver,
        isBuild,
        isCelebrate,
        isMoveGod,
        isMove,
        isScoreIsland,
        isChooseScoringIsland,
        isBoatBuildingCell
    } from '@tabletop/kaivai'
    import { fadeScale, GameSessionMode } from '@tabletop/frontend-components'
    import { flipIn, flipInterest, flipKey, flipOut, saveFlipState } from '$lib/utils/transition'
    import { fade } from 'svelte/transition'

    let gameSession = getContext('gameSession') as KaivaiGameSession
    let { hex, origin }: { hex: Hex; origin: Point } = $props()
    let cell = $derived(gameSession.gameState.board.cells[coordinatesToNumber(hex)])
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

    let boat = $derived.by(() => {
        if (isBoatCell(cell) && cell.boat) {
            return cell.boat
        } else if (sameCoordinates(gameSession.chosenBoatLocation, hex)) {
            return { id: gameSession.chosenBoat, owner: gameSession.myPlayer?.id }
        }
        return undefined
    })

    let boatNode: Element | undefined = $state()

    // This is required to make the boatId live long enough to be used in the flip transitions
    let boatId: string | undefined = $state()
    $effect(() => {
        const newBoatId = boat?.id
        // On a boatId change we have to manually intiate parts of the flip because the in/out transitions
        // will not be triggered
        if (newBoatId && boatId && newBoatId !== boatId) {
            if (boatNode) {
                // To allow the corresponding in to be triggered (unsink the boat)
                saveFlipState(boatNode, boatId)

                // To flip the boat in (sink the boat)
                flipInterest(newBoatId) // Make sure the out will store the flip state

                // Flip after the out transition has a chance to store the state
                setTimeout(() => {
                    flipKey(newBoatId, { targets: boatNode, duration: 0.2 })
                }, 0)
            }
            boatId = newBoatId
        } else {
            boatId = newBoatId
        }
    })

    let hasGod = $derived(
        gameSession.gameState.godLocation?.coords.q === hex.q &&
            gameSession.gameState.godLocation?.coords.r === hex.r
    )
    let numFish = $derived.by(() => {
        return isDeliveryCell(cell) ? cell.fish : 0
    })

    let numDeliveredFish = $derived.by(() => {
        const delivery = gameSession.chosenDeliveries.find((d) => sameCoordinates(d.coords, hex))
        return delivery?.amount ?? 0
    })

    let hasFish = $derived(numFish > 0)
    let hasFishToken = $derived(numDeliveredFish > 0)

    let playerColor = $derived.by(() => {
        if (isBoatCell(cell) && cell.boat) {
            return gameSession.colors.getPlayerUiColor(cell.boat.owner)
        } else if (isFishingCell(cell)) {
            return gameSession.colors.getPlayerUiColor(cell.owner)
        } else {
            return gameSession.colors.getPlayerUiColor(gameSession.myPlayer?.id)
        }
    })

    let interacting = $derived.by(() => {
        if (!gameSession.isPlayable) {
            return false
        }

        switch (gameSession.chosenAction) {
            case ActionType.Build: {
                if (
                    gameSession.gameState.machineState === MachineState.InitialHuts &&
                    gameSession.chosenHutType !== undefined
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
            case ActionType.MoveGod:
            case ActionType.ChooseScoringIsland: {
                return true
            }
            default:
                return false
        }
    })

    let interactable = $derived.by(() => {
        if (!gameSession.isPlayable) {
            return false
        }

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
        } else if (gameSession.chosenAction === ActionType.ChooseScoringIsland) {
            return isInteractableForChooseScoringIsland()
        }
        return false
    })

    function isInteractableForBuild(): boolean {
        if (!gameSession.chosenBoat) {
            const boat = getBoat()
            return boat !== undefined && gameSession.usableBoats.includes(boat.id)
        } else if (!gameSession.chosenBoatLocation) {
            return gameSession.validBoatLocationIds.has(coordinatesToNumber(hex))
        } else if (gameSession.chosenHutType) {
            // Why is checking every cell faster than using the validBuildLocationIds set?
            const { valid } = HydratedBuild.isValidPlacement(gameSession.gameState, {
                playerId: gameSession.myPlayer!.id,
                hutType: gameSession.chosenHutType!,
                coords: hex,
                boatId: gameSession.chosenBoat,
                boatCoords: gameSession.chosenBoatLocation
            })
            return valid
            // return gameSession.validBuildLocationIds.has(coordinatesToNumber(hex))
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
            return gameSession.validBoatLocationIds.has(coordinatesToNumber(hex))
        }
        return false
    }

    function isInteractableForDeliver(): boolean {
        if (!gameSession.chosenBoat) {
            const boat = getBoat()
            return boat !== undefined && gameSession.usableBoats.includes(boat.id)
        } else if (!gameSession.chosenBoatLocation) {
            return gameSession.validBoatLocationIds.has(coordinatesToNumber(hex))
        } else {
            return gameSession.validDeliveryLocationIds.includes(coordinatesToNumber(hex))
        }
        return false
    }

    function isInteractableForMove(): boolean {
        if (!gameSession.chosenBoat) {
            const boat = getBoat()
            return boat !== undefined && gameSession.usableBoats.includes(boat.id)
        } else if (!gameSession.chosenBoatLocation) {
            return gameSession.validBoatLocationIds.has(coordinatesToNumber(hex))
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

    function isInteractableForChooseScoringIsland(): boolean {
        if (!isIslandCell(cell)) {
            return false
        }
        return gameSession.gameState.islandsToScore.includes(cell?.islandId)
    }

    let disabled = $derived.by(() => {
        const state = gameSession.gameState
        if (gameSession.isViewingHistory && gameSession.currentActionIndex >= 0) {
            const action = gameSession.currentAction

            switch (true) {
                case isFish(action):
                    return !sameCoordinates(hex, action.boatCoords)
                case isDeliver(action):
                    return (
                        !sameCoordinates(hex, action.boatCoords) &&
                        !action.deliveries.some((delivery) => sameCoordinates(hex, delivery.coords))
                    )
                case isBuild(action):
                    return (
                        !sameCoordinates(hex, action.coords) &&
                        !sameCoordinates(hex, action.boatCoords)
                    )

                case isCelebrate(action):
                    return !isIslandCell(cell) || cell.islandId !== action.islandId

                case isChooseScoringIsland(action):
                    return !isIslandCell(cell) || cell.islandId !== action.islandId

                case isScoreIsland(action):
                    if (isBoatCell(cell) && !isBoatBuildingCell(cell) && cell.boat) {
                        return !state.board.isNeighborToCultSiteOfIsland(
                            cell.coords,
                            action.islandId
                        )
                    }
                    return !isIslandCell(cell) || cell.islandId !== action.islandId

                case isMoveGod(action):
                    return !sameCoordinates(hex, action.coords)

                case isMove(action):
                    return !sameCoordinates(hex, action.boatCoords)
            }
            return false
        }

        if (gameSession.highlightedHexes.size > 0) {
            if (!gameSession.highlightedHexes.has(coordinatesToNumber(hex))) {
                return true
            } else {
                return false
            }
        }

        if (state.machineState === MachineState.IslandBidding && state.chosenIsland !== undefined) {
            if (isBoatCell(cell) && !isBoatBuildingCell(cell) && cell.boat) {
                return !state.board.isNeighborToCultSiteOfIsland(cell.coords, state.chosenIsland)
            }
            return !state.board.islands[state.chosenIsland].coordList.find((c) =>
                sameCoordinates(c, hex)
            )
        }

        if (state.machineState === MachineState.FinalScoring) {
            if (isBoatCell(cell) && !isBoatBuildingCell(cell) && cell.boat) {
                return !state.islandsToScore.some((islandId) => {
                    return state.board.isNeighborToCultSiteOfIsland(cell.coords, islandId)
                })
            }
            return (
                !isIslandCell(cell) ||
                !gameSession.gameState.islandsToScore.includes(cell?.islandId)
            )
        }

        return interacting && !interactable
    })

    let hidden = $derived.by(() => {
        const state = gameSession.gameState

        if (![MachineState.FinalScoring, MachineState.IslandBidding].includes(state.machineState)) {
            return false
        }

        if (
            gameSession.isViewingHistory &&
            (!gameSession.lastAction ||
                (!isScoreIsland(gameSession.lastAction) &&
                    !isChooseScoringIsland(gameSession.lastAction)))
        ) {
            return false
        }

        const islandsToCheck = $state.snapshot(state.islandsToScore)
        if (gameSession.isViewingHistory && gameSession.currentActionIndex >= 0) {
            const action = gameSession.actions[gameSession.currentActionIndex]
            if (isScoreIsland(action)) {
                islandsToCheck.push(action.islandId)
            }
        }

        return (
            (isIslandCell(cell) && !islandsToCheck.includes(cell?.islandId)) ||
            (isBoatCell(cell) &&
                cell.boat &&
                !islandsToCheck.some((islandId) => {
                    return state.board.isNeighborToCultSiteOfIsland(cell.coords, islandId)
                }))
        )
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
        // gameSession.resetAction()
        await gameSession.applyAction(action)
    }

    async function fish() {
        if (!gameSession.chosenBoat || !gameSession.chosenBoatLocation) {
            return
        }

        const action = gameSession.createFishAction({
            boatId: gameSession.chosenBoat,
            boatCoords: gameSession.chosenBoatLocation
        })
        // gameSession.resetAction()
        await gameSession.applyAction(action)
    }

    async function move() {
        if (!gameSession.chosenBoat || !gameSession.chosenBoatLocation) {
            return
        }

        const action = gameSession.createMoveAction({
            boatId: gameSession.chosenBoat,
            boatCoords: gameSession.chosenBoatLocation
        })
        // gameSession.resetAction()
        await gameSession.applyAction(action)
    }

    async function celebrate() {
        if (!isIslandCell(cell)) {
            return
        }
        const action = gameSession.createCelebrateAction(cell.islandId)
        // gameSession.resetAction()
        await gameSession.applyAction(action)
    }

    async function moveGod() {
        const action = gameSession.createMoveGodAction({ q: hex.q, r: hex.r })
        // gameSession.resetAction()
        await gameSession.applyAction(action)
    }

    async function chooseScoringIsland() {
        if (!isIslandCell(cell)) {
            return
        }
        const action = gameSession.createChooseScoringIslandAction(cell.islandId)
        // gameSession.resetAction()
        await gameSession.applyAction(action)
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
        } else if (gameSession.chosenAction === ActionType.ChooseScoringIsland) {
            await chooseScoringIsland()
            return
        }
    }

    function getBoat() {
        if (!cell || (cell.type !== CellType.BoatBuilding && cell.type !== CellType.Water)) {
            return undefined
        }
        return cell.boat
    }
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
    {#if !hidden}
        <polygon
            points="25,-43.5 50,0 25,43.5 -25,43.5 -50,0 -25,-43.5"
            fill="none"
            stroke="none"
            opacity="1"
        ></polygon>
        {#if cellImage}
            <g transform="rotate(30)">
                <image
                    in:fadeScale={{ baseScale: 0.1, duration: 100 }}
                    out:fadeScale={{ baseScale: 0.1, duration: 100 }}
                    href={cellImage}
                    x={-hex.height / 2}
                    y={-hex.width / 2}
                    width={hex.height}
                    height={hex.width}
                ></image>
            </g>
        {/if}

        {#if hasFisherman}
            <g
                in:fadeScale={{ baseScale: 0.1, duration: 100 }}
                out:fadeScale={{ baseScale: 0.1, duration: 100 }}
            >
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
            </g>
        {/if}
        {#if hasBoat && boatId}
            <g
                class="z-40"
                bind:this={boatNode}
                in:flipIn={{ key: boatId, duration: 200 }}
                out:flipOut={{ key: boatId }}
                data-flip-id={boatId}
            >
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
            </g>
        {/if}

        {#if hasGod}
            <g
                in:flipIn={{ key: 'god', duration: 200 }}
                out:flipOut={{ key: 'god' }}
                data-flip-id="god"
            >
                <FishGod x={-40} y={-40} width={80} height={80} />
            </g>
        {/if}

        {#if hasFish}
            <text
                class="kaivai-font select-none"
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
                class="kaivai-font select-none"
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

        {#if hasFishToken}
            <image href={fishtoken} x={-25} y={-25} width="50px" height="50px"></image>
            <circle cx="0" cy="0" r="25" fill="black" stroke="black" opacity=".1" stroke-width="2"
            ></circle>
            <text
                class="kaivai-font select-none"
                style="filter: url(#textshadow); fill: black"
                y="0"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="50"
                font-weight="bold"
                stroke-width="1"
                stroke="#000000"
                opacity=".5"
                fill="black">{numDeliveredFish}</text
            >
            <text
                class="kaivai-font select-none"
                y="5"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="50"
                font-weight="bold"
                stroke-width="1"
                stroke="#FFFFFF"
                fill="white"
                >{numDeliveredFish}
            </text>
        {/if}
    {/if}
    {#if disabled}
        <polygon
            in:fade={{ duration: 150 }}
            out:fade={{ duration: 150 }}
            points="25,-43.5 50,0 25,43.5 -25,43.5 -50,0 -25,-43.5"
            class="z-40"
            fill="black"
            opacity="0.35"
        ></polygon>
    {/if}
    <!-- <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size="30" fill="yellow">
        {hex.q}, {hex.r}
    </text> -->
</g>
