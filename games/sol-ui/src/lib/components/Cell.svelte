<script lang="ts">
    import { getContext } from 'svelte'
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
        EffectType,
        HydratedActivate,
        HydratedBlight,
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
    import EnergyNode from '$lib/images/energynode.svelte'
    import EnergyNodeMask from '$lib/images/energynodeMask.svelte'
    import Foundry from '$lib/images/foundry.svelte'
    import FoundryMask from '$lib/images/foundryMask.svelte'
    import Tower from '$lib/images/tower.svelte'
    import TowerMask from '$lib/images/towerMask.svelte'
    import BoardSvg from './BoardSvg.svelte'
    import { animateStation, CellStationAnimator } from '$lib/animators/cellStationAnimator.js'

    let { cell }: { cell: Cell } = $props()
    const gameSession = getContext('gameSession') as SolGameSession
    const dimensions = dimensionsForSpace(gameSession.numPlayers, cell.coords)
    const isCenterCell = sameCoordinates(cell.coords, CENTER_COORDS)
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

    let interactable = $derived.by(() => {
        const myPlayerState = gameSession.myPlayerState
        if (!myPlayerState || (!myMove && !myConvert && !myActivate && !myHatch && !myTribute)) {
            return false
        }

        if (myHatch) {
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
        } else if (myMove) {
            if (gameSession.chosenMothership) {
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
                    if (isCenterCell) {
                        return HydratedHurl.canHurl(gameSession.gameState, myPlayerState.playerId)
                    } else if (gameSession.teleportChoice === true) {
                        return true
                    } else {
                        console.log('catapultchoice', gameSession.catapultChoice)
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
                    gameSession.gameState.board.hasStationAt(cell.coords, myPlayerState.playerId)
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
            } else if (gameSession.gameState.activeEffect === EffectType.Sacrifice) {
                return HydratedSacrifice.canSacrificeAt(gameSession.gameState, cell.coords)
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

    let disabled = $derived(
        !gameSession.animating &&
            (myMove ||
                (myConvert &&
                    (gameSession.chosenConvertType ||
                        gameSession.gameState.activeEffect === EffectType.Invade ||
                        gameSession.gameState.activeEffect === EffectType.Sacrifice)) ||
                (myActivate &&
                    !gameSession.chosenSource &&
                    !gameSession.gameState.activation?.currentStationId) ||
                (myHatch && !gameSession.hatchLocation) ||
                (myTribute && !gameSession.chosenSource)) &&
            !interactable
    )

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

    async function onClick() {
        if (!interactable) {
            return
        }

        if (myHatch) {
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
            } else if (gameSession.gameState.activeEffect === EffectType.Sacrifice) {
                gameSession.chosenDestination = cell.coords
                await gameSession.sacrifice()
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
</script>

{#snippet renderStation(station: Station, width: number, height: number)}
    <g use:animateStation={{ animator: stationAnimator, station }}>
        <BoardSvg {width} {height} location={stationLocation}>
            {#if station.type === StationType.EnergyNode}
                <g transform="translate(-2, -2)">
                    <EnergyNodeMask
                        width={width + 4}
                        height={height + 4}
                        fill={'black'}
                        opacity=".5"
                        overflow="visible"
                        style="filter: url(#pieceshadow)"
                    />
                </g>
                <EnergyNode
                    id={station.id}
                    {width}
                    {height}
                    color={gameSession.colors.getPlayerColor(station.playerId)}
                />
            {:else if station.type === StationType.SundiverFoundry}
                <g transform="translate(-2, -2)">
                    <FoundryMask
                        width={width + 4}
                        height={height + 4}
                        fill={'black'}
                        opacity=".5"
                        overflow="visible"
                        style="filter: url(#pieceshadow)"
                    />
                </g>
                <Foundry
                    {width}
                    {height}
                    color={gameSession.colors.getPlayerColor(station.playerId)}
                />
            {:else if station.type === StationType.TransmitTower}
                <g transform="translate(-2, -2)">
                    <TowerMask
                        width={width + 4}
                        height={height + 4}
                        fill={'black'}
                        opacity=".5"
                        overflow="visible"
                        style="filter: url(#pieceshadow)"
                    />
                </g>
                <Tower
                    {width}
                    {height}
                    color={gameSession.colors.getPlayerColor(station.playerId)}
                />
            {/if}
        </BoardSvg>
    </g>
{/snippet}

{#each gameSession.game.players as player (player.id)}
    <Sundiver
        location={gameSession.locationForDiverInCell(player.id, cell) ?? { x: 0, y: 0 }}
        color={gameSession.colors.getPlayerColor(player.id)}
        quantity={numSundiversByPlayer.get(player.id)}
        animator={animatorPerPlayer.get(player.id)}
    />
{/each}

{#if station}
    {#if station.type === StationType.EnergyNode}
        {@render renderStation(station, 46, 48)}
    {:else if station.type === StationType.SundiverFoundry}
        {@render renderStation(station, 46, 48)}
    {:else if station.type === StationType.TransmitTower}
        {@render renderStation(station, 48, 100)}
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
