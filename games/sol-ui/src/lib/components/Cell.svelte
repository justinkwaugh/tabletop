<script lang="ts">
    import { SvelteMap } from 'svelte/reactivity'
    import '$lib/styles/focusable-control.css'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { coordinatesToNumber, sameCoordinates } from '@tabletop/common'
    import {
        dimensionsForSpace,
        getCirclePoint,
        RING_RADII,
        toRadians,
        translateFromCenter
    } from '$lib/utils/boardGeometry.js'
    import {
        CENTER_COORDS,
        ChainEntry,
        EffectType,
        HydratedActivate,
        HydratedBlight,
        HydratedChain,
        HydratedDeconstruct,
        HydratedFly,
        HydratedHatch,
        HydratedHurl,
        HydratedInvade,
        HydratedSacrifice,
        HydratedTribute,
        Ring,
        Station,
        StationType,
        type Cell
    } from '@tabletop/sol'
    import Sundiver from './Sundiver.svelte'
    import { CellSundiverAnimator } from '$lib/animators/cellSundiverAnimator.js'
    import { ConvertType } from '$lib/definition/convertType.js'
    import { animateStation, CellStationAnimator } from '$lib/animators/cellStationAnimator.js'
    import UIStation from './Station.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let { cell }: { cell: Cell } = $props()
    const gameSession = getGameSession() as SolGameSession
    const dimensions = $derived(dimensionsForSpace(gameSession.numPlayers, cell.coords))
    const isCenterCell = $derived(sameCoordinates(cell.coords, CENTER_COORDS))
    let station: Station | undefined = $derived(cell.station)
    let stationLocation: { x: number; y: number } = $derived(
        gameSession.locationForStationInCell(cell) ?? { x: 0, y: 0 }
    )

    let myMove = $derived(gameSession.isMyTurn && gameSession.isMoving)

    let myConvert = $derived(gameSession.isMyTurn && gameSession.isConverting)

    let myActivate = $derived(
        gameSession.isMyTurn && (gameSession.isActivating || gameSession.isSolarFlares)
    )

    let myHatch = $derived(gameSession.isMyTurn && gameSession.isHatching)
    let myTribute = $derived(gameSession.isMyTurn && gameSession.isTributing)
    let myChain = $derived(gameSession.isMyTurn && gameSession.isChaining)

    let interactable = $derived.by(() => {
        const myPlayerState = gameSession.myPlayerState
        if (
            !myPlayerState ||
            (!myMove &&
                !myConvert &&
                !myActivate &&
                !myHatch &&
                !myTribute &&
                !myChain &&
                !gameSession.canDeconstruct)
        ) {
            return false
        }

        if (gameSession.canDeconstruct) {
            return HydratedDeconstruct.canDeconstructAt(
                gameSession.gameState,
                myPlayerState.playerId,
                cell.coords
            )
        } else if (myHatch) {
            return HydratedHatch.canHatchAt(
                gameSession.gameState,
                myPlayerState.playerId,
                cell.coords
            )
        } else if (myTribute) {
            return HydratedTribute.canTributeAt(
                gameSession.gameState,
                myPlayerState.playerId,
                cell.coords
            )
        } else if (myChain) {
            if (gameSession.chain?.find((entry) => entry.sundiverId === undefined)) {
                return false
            }

            if (!gameSession.chain || gameSession.chain.length === 0) {
                return HydratedChain.canInitiateChainAt(gameSession.gameState, cell.coords)
            }

            if (
                HydratedChain.isChainComplete(gameSession.gameState, gameSession.chain) &&
                !gameSession.chainStart
            ) {
                return (
                    sameCoordinates(gameSession.chain[0].coords, cell.coords) ||
                    sameCoordinates(
                        gameSession.chain[gameSession.chain.length - 1].coords,
                        cell.coords
                    )
                )
            }
            return HydratedChain.canContinueChainAt(
                gameSession.gameState,
                gameSession.chain,
                cell.coords
            )
        } else if (myMove) {
            if (gameSession.gateChoices && gameSession.gateChoices.length > 0) {
                return false
            } else if (gameSession.chosenMothership) {
                if (gameSession.chosenNumDivers) {
                    const launchCoords = gameSession.gameState.board.launchCoordinatesForMothership(
                        gameSession.chosenMothership,
                        gameSession.gameState.activeEffect === EffectType.Portal
                    )
                    const isLaunchCell = launchCoords.some((coords) =>
                        sameCoordinates(coords, cell.coords)
                    )
                    return (
                        isLaunchCell &&
                        gameSession.gameState.board.canAddSundiversToCell(
                            myPlayerState.playerId,
                            gameSession.chosenNumDivers,
                            cell.coords
                        )
                    )
                }
            } else if (gameSession.chosenSource) {
                if (gameSession.chosenNumDivers || gameSession.juggernautStationId) {
                    if (gameSession.teleportChoice === true) {
                        return !sameCoordinates(cell.coords, gameSession.chosenSource)
                    } else {
                        if (
                            isCenterCell &&
                            !HydratedHurl.canHurl(gameSession.gameState, myPlayerState.playerId)
                        ) {
                            return false
                        }
                        // console.log('catapultchoice', gameSession.catapultChoice)
                        return HydratedFly.isValidFlightDestination({
                            state: gameSession.gameState,
                            playerId: myPlayerState.playerId,
                            numSundivers: gameSession.chosenNumDivers ?? 0,
                            start: gameSession.chosenSource,
                            destination: cell.coords,
                            cluster: gameSession.clusterChoice,
                            juggernaut: gameSession.juggernautStationId !== undefined,
                            catapult: gameSession.catapultChoice ?? false
                        })
                    }
                }
            } else {
                const sundivers = gameSession.gameState.board.sundiversForPlayerAt(
                    myPlayerState.playerId,
                    cell.coords
                )

                if (
                    gameSession.gameState.activeEffect === EffectType.Juggernaut &&
                    gameSession.gameState.board.hasStationAt(cell.coords, myPlayerState.playerId) &&
                    (gameSession.gameState.getEffectTracking().flownStationId === undefined ||
                        gameSession.gameState.getEffectTracking().flownStationId ===
                            gameSession.gameState.board.cellAt(cell.coords).station?.id)
                ) {
                    return true
                }

                if (!sundivers || sundivers.length === 0) {
                    return false
                }

                if (myPlayerState.movementPoints === 0) {
                    return (
                        sundivers.some(
                            (sundiver) =>
                                !gameSession.gameState
                                    .getEffectTracking()
                                    .catapultedIds.includes(sundiver.id)
                        ) &&
                        gameSession.gameState.activeEffect === EffectType.Catapult &&
                        gameSession.gameState.board.isNextToGateAt(cell.coords)
                    )
                }

                if (gameSession.gameState.activeEffect === EffectType.Puncture) {
                    return HydratedFly.canPunctureFrom(
                        cell.coords,
                        gameSession.gameState,
                        myPlayerState.playerId
                    )
                }

                if (
                    gameSession.gameState.activeEffect === EffectType.Hyperdrive &&
                    gameSession.gameState.effectTracking?.flownSundiverId
                ) {
                    const flownSundiverId = gameSession.gameState.effectTracking.flownSundiverId
                    return sundivers.some((sundiver) => sundiver.id === flownSundiverId)
                }
                return true
            }
        } else if (myConvert) {
            if (gameSession.gameState.activeEffect === EffectType.Invade) {
                return HydratedInvade.canInvadeAt(
                    gameSession.gameState,
                    myPlayerState.playerId,
                    cell.coords
                )
            } else if (gameSession.chosenConvertType === ConvertType.SolarGate) {
                return gameSession.diverCellChoices?.includes(coordinatesToNumber(cell.coords))
            } else if (gameSession.chosenConvertType === ConvertType.EnergyNode) {
                return gameSession.gameState.board.canConvertStationAt(
                    myPlayerState.playerId,
                    StationType.EnergyNode,
                    cell.coords
                )
            } else if (gameSession.chosenConvertType === ConvertType.SundiverFoundry) {
                if (gameSession.diverCellChoices) {
                    return gameSession.diverCellChoices?.includes(coordinatesToNumber(cell.coords))
                }
                return gameSession.gameState.board.canConvertStationAt(
                    myPlayerState.playerId,
                    StationType.SundiverFoundry,
                    cell.coords
                )
            } else if (gameSession.chosenConvertType === ConvertType.TransmitTower) {
                if (gameSession.diverCellChoices) {
                    return gameSession.diverCellChoices?.includes(coordinatesToNumber(cell.coords))
                }
                return gameSession.gameState.board.canConvertStationAt(
                    myPlayerState.playerId,
                    StationType.TransmitTower,
                    cell.coords
                )
            }
        } else if (myActivate) {
            if (
                gameSession.gameState.activeEffect === EffectType.Blight &&
                !gameSession.chosenSource
            ) {
                return HydratedBlight.canBlightAnyMothershipFrom(
                    gameSession.gameState,
                    myPlayerState.playerId,
                    cell.coords
                )
            } else if (gameSession.gameState.activeEffect === EffectType.Sacrifice) {
                return HydratedSacrifice.canSacrificeAt(gameSession.gameState, cell.coords)
            } else if (!gameSession.chosenSource && cell.station) {
                return HydratedActivate.canActivateStationAt(
                    gameSession.gameState,
                    myPlayerState.playerId,
                    cell.coords
                )
            }
        }

        return false
    })

    let disabled = $derived.by(() => {
        if (!gameSession.isMyTurn) {
            return false
        }
        if (gameSession.updatingVisibleState) {
            return false
        }
        if (interactable) {
            return false
        }

        if (myActivate) {
            const myActivation = gameSession.gameState.getActivationForTurnPlayer()
            return (
                (!gameSession.chosenSource && !myActivation?.currentStationId) ||
                (myActivation && !sameCoordinates(myActivation.currentStationCoords, cell.coords))
            )
        }

        return (
            gameSession.canDeconstruct ||
            myMove ||
            (myChain &&
                !gameSession.chain?.find((entry) => sameCoordinates(entry.coords, cell.coords))) ||
            (myConvert &&
                (gameSession.chosenConvertType ||
                    gameSession.gameState.activeEffect === EffectType.Invade ||
                    gameSession.gameState.activeEffect === EffectType.Sacrifice)) ||
            (myHatch && !gameSession.hatchLocation) ||
            (myTribute && !gameSession.chosenSource)
        )
    })

    function cellPath(
        innerRadius: number,
        outerRadius: number,
        startDegrees: number,
        endDegrees: number
    ) {
        const startAngle = toRadians(startDegrees)
        const endAngle = toRadians(endDegrees)
        const start = getCirclePoint(innerRadius, startAngle)
        const end = getCirclePoint(innerRadius, endAngle)
        const startOuter = getCirclePoint(outerRadius, startAngle)
        const endOuter = getCirclePoint(outerRadius, endAngle)
        return `M${start.x} ${start.y} L${startOuter.x} ${startOuter.y} A${outerRadius} ${outerRadius} 0 0 1 ${endOuter.x} ${endOuter.y} L${end.x} ${end.y} A${innerRadius} ${innerRadius} 0 0 0 ${start.x} ${start.y}Z`
    }

    function makeChainEntry() {
        const entry: ChainEntry = { sundiverId: undefined, coords: cell.coords }
        const players = gameSession.gameState.board.playersWithSundiversAt(cell.coords)
        if (players.length === 1) {
            entry.sundiverId = gameSession.gameState.board.cellAt(cell.coords).sundivers[0].id
        }
        return entry
    }

    async function onClick() {
        if (!interactable) {
            return
        }

        if (gameSession.canDeconstruct) {
            gameSession.chosenSource = cell.coords
            await gameSession.deconstruct()
        } else if (myHatch) {
            gameSession.hatchLocation = cell.coords
            const otherPlayersAt = gameSession.gameState.board
                .playersWithSundiversAt(cell.coords)
                .filter((playerId) => playerId !== gameSession.myPlayer?.id)
            if (otherPlayersAt.length === 1) {
                gameSession.hatchTarget = otherPlayersAt[0]
                await gameSession.hatch()
            }
        } else if (myTribute) {
            gameSession.chosenSource = cell.coords
            await gameSession.tribute()
        } else if (myChain) {
            const entry = makeChainEntry()
            // Start
            if (!gameSession.chain || gameSession.chain.length === 0) {
                gameSession.chain = [entry]
            } else if (HydratedChain.isChainComplete(gameSession.gameState, gameSession.chain)) {
                if (sameCoordinates(gameSession.chain[0].coords, cell.coords)) {
                    gameSession.chainStart = 'beginning'
                } else {
                    gameSession.chainStart = 'end'
                }
                await gameSession.doChain()
            } else {
                const firstEnd = gameSession.chain[0]
                if (gameSession.gameState.board.areAdjacent(firstEnd.coords, cell.coords)) {
                    gameSession.chain.unshift(entry)
                } else {
                    gameSession.chain.push(entry)
                }

                if (
                    HydratedChain.isChainComplete(gameSession.gameState, gameSession.chain) &&
                    gameSession.chain.length % 2 === 1
                ) {
                    gameSession.chainStart = 'beginning'
                    await gameSession.doChain()
                }
            }
        } else if (myMove) {
            if (gameSession.chosenMothership) {
                gameSession.chosenDestination = cell.coords
                gameSession.launch()
            } else if (gameSession.chosenSource) {
                gameSession.chosenDestination = cell.coords
                if (isCenterCell) {
                    gameSession.hurl()
                } else {
                    gameSession.fly()
                }
            } else {
                gameSession.chosenSource = cell.coords

                const canMoveStation = gameSession.canMoveStationFromSource()
                if (
                    gameSession.gameState.activeEffect !== EffectType.Catapult &&
                    gameSession.numPlayerCanMoveFromSource() === 1 &&
                    !canMoveStation
                ) {
                    gameSession.chosenNumDivers = 1
                } else if (canMoveStation && gameSession.numPlayerCanMoveFromSource() === 0) {
                    gameSession.juggernautStationId = cell.station?.id
                }
            }
        } else if (myConvert) {
            if (gameSession.gameState.activeEffect === EffectType.Invade) {
                gameSession.chosenDestination = cell.coords
                await gameSession.invade()
            } else if (gameSession.diverCellChoices) {
                if (gameSession.chosenDiverCell) {
                    gameSession.chosenSecondDiverCell = cell.coords
                } else {
                    gameSession.chosenDiverCell = cell.coords
                }
                if (gameSession.chosenConvertType === ConvertType.SolarGate) {
                    await gameSession.convertGate()
                } else if (gameSession.chosenConvertType === ConvertType.SundiverFoundry) {
                    await gameSession.convertSundiverFoundry()
                } else if (gameSession.chosenConvertType === ConvertType.TransmitTower) {
                    await gameSession.convertTransmitTower()
                }
            } else if (gameSession.chosenConvertType === ConvertType.EnergyNode) {
                gameSession.chosenSource = cell.coords
                await gameSession.convertEnergyNode()
            } else if (gameSession.chosenConvertType === ConvertType.SundiverFoundry) {
                gameSession.chosenSource = cell.coords
                await gameSession.convertSundiverFoundry()
            } else if (gameSession.chosenConvertType === ConvertType.TransmitTower) {
                gameSession.chosenSource = cell.coords
                await gameSession.convertTransmitTower()
            }
        } else if (myActivate) {
            gameSession.chosenSource = cell.coords

            if (gameSession.gameState.activeEffect === EffectType.Blight) {
                await gameSession.blight()
            } else if (gameSession.gameState.activeEffect === EffectType.Sacrifice) {
                gameSession.chosenDestination = cell.coords
                await gameSession.sacrifice()
            } else {
                await gameSession.activateStation()
            }
        }
    }

    function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick()
        }
    }

    let numSundiversByPlayer = $derived.by(() => {
        const sundivers = cell.sundivers
        const sundiverMap = new SvelteMap<string, number>()
        sundivers.forEach((sundiver) => {
            const current = sundiverMap.get(sundiver.playerId) ?? 0
            sundiverMap.set(sundiver.playerId, current + 1)
        })
        return sundiverMap
    })

    // Pre-create animators for each player sundiver in this cell
    // to avoid creating them over and over due to reactivity
    const animatorPerPlayer = new Map<string, CellSundiverAnimator>()
    for (const player of gameSession.game.players) {
        animatorPerPlayer.set(
            player.id,
            new CellSundiverAnimator(gameSession, player.id, cell.coords)
        )
    }

    const stationAnimator = new CellStationAnimator(
        gameSession,
        cell.coords,
        (newStation, newStationLocation) => {
            station = newStation
            stationLocation = newStationLocation || { x: 0, y: 0 }
        }
    )
    stationAnimator.register()
    let stationClipRect: SVGRectElement | undefined = $state(undefined)

    let hovered = false
    function onMouseEnter() {
        if (interactable) {
            gameSession.outlinedCells.push(cell.coords)
            hovered = true
        }
    }

    function onMouseLeave() {
        if (hovered) {
            hovered = false
            gameSession.outlinedCells = gameSession.outlinedCells.filter(
                (coords) => !sameCoordinates(coords, cell.coords)
            )
        }
    }
</script>

{#snippet renderStation(station: Station, width: number, height: number)}
    <defs>
        <clipPath
            id={`station-clip-${coordinatesToNumber(cell.coords)}`}
            clipPathUnits="objectBoundingBox"
        >
            <rect bind:this={stationClipRect} x="0" y="0" width="1" height="1"></rect>
        </clipPath>
    </defs>
    <g
        use:animateStation={{ animator: stationAnimator, station, clipRect: stationClipRect }}
        clip-path={`url(#station-clip-${coordinatesToNumber(cell.coords)})`}
        transform={translateFromCenter(stationLocation.x, stationLocation.y)}
    >
        <UIStation
            {station}
            {width}
            {height}
            color={gameSession.colors.getPlayerColor(station.playerId)}
        />
    </g>
{/snippet}

{#each gameSession.game.players as player (player.id)}
    <g class="pointer-events-none">
        <Sundiver
            location={gameSession.locationForDiverInCell(player.id, cell) ?? { x: 0, y: 0 }}
            color={gameSession.colors.getPlayerColor(player.id)}
            quantity={numSundiversByPlayer.get(player.id)}
            animator={animatorPerPlayer.get(player.id)}
        />
    </g>
{/each}

{#if station}
    {#if station.type === StationType.EnergyNode}
        {@render renderStation(station, 46, 48)}
    {:else if station.type === StationType.SundiverFoundry}
        {@render renderStation(station, 46, 48)}
    {:else if station.type === StationType.TransmitTower}
        {@render renderStation(station, 43, 95)}
    {/if}
{/if}

<g
    id={`cell-${coordinatesToNumber(cell.coords)}`}
    class="focusable-control"
    role="button"
    tabindex={interactable ? 0 : -1}
    aria-disabled={interactable}
    onclick={onClick}
    onkeydown={onKeyDown}
    transform={translateFromCenter(0, 0)}
    stroke="none"
    onmouseenter={onMouseEnter}
    onmouseleave={onMouseLeave}
>
    {#if isCenterCell}
        <circle r={RING_RADII[Ring.Center][1]} fill="transparent"></circle>
    {:else}
        <path
            d={cellPath(
                dimensions.innerRadius,
                dimensions.outerRadius,
                dimensions.startDegrees,
                dimensions.endDegrees
            )}
            fill="transparent"
        ></path>
    {/if}
</g>

{#if disabled}
    <g transform={translateFromCenter(0, 0)} stroke="none">
        {#if isCenterCell}
            <circle r={RING_RADII[Ring.Center][1]} opacity="0.5" fill="black"></circle>
        {:else}
            <path
                d={cellPath(
                    dimensions.innerRadius,
                    dimensions.outerRadius,
                    dimensions.startDegrees,
                    dimensions.endDegrees
                )}
                opacity="0.5"
                fill="black"
            ></path>
        {/if}
    </g>
{/if}
