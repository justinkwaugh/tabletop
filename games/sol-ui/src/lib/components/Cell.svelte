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
        HydratedActivate,
        HydratedFly,
        HydratedHurl,
        Ring,
        StationType,
        type Cell
    } from '@tabletop/sol'
    import { ActionCategory } from '$lib/definition/actionCategory.js'
    import Sundiver from './Sundiver.svelte'
    import { CellSundiverAnimator } from '$lib/animators/cellSundiverAnimator.js'
    import { ConvertType } from '$lib/definition/convertType.js'
    import EnergyNode from '$lib/images/energynode.svelte'
    import Foundry from '$lib/images/foundry.svelte'
    import Tower from '$lib/images/tower.svelte'
    import BoardSvg from './BoardSvg.svelte'

    let { cell }: { cell: Cell } = $props()
    const gameSession = getContext('gameSession') as SolGameSession
    const dimensions = dimensionsForSpace(gameSession.numPlayers, cell.coords)
    const isCenterCell = sameCoordinates(cell.coords, CENTER_COORDS)

    let myMove = $derived(
        gameSession.isMyTurn && gameSession.chosenActionCategory === ActionCategory.Move
    )

    let myConvert = $derived(
        gameSession.isMyTurn && gameSession.chosenActionCategory === ActionCategory.Convert
    )

    let myActivate = $derived(
        gameSession.isMyTurn &&
            (gameSession.isActivating ||
                gameSession.isSolarFlares ||
                gameSession.chosenActionCategory === ActionCategory.Activate)
    )

    let interactable = $derived.by(() => {
        const myPlayer = gameSession.myPlayer
        if (!myPlayer || (!myMove && !myConvert && !myActivate)) {
            return false
        }

        if (myMove) {
            if (gameSession.chosenMothership) {
                if (gameSession.chosenNumDivers) {
                    const launchCoords = gameSession.gameState.board.launchCoordinatesForMothership(
                        gameSession.chosenMothership
                    )
                    const isLaunchCell = launchCoords.some((coords) =>
                        sameCoordinates(coords, cell.coords)
                    )
                    return (
                        isLaunchCell &&
                        gameSession.gameState.board.canAddSundiversToCell(
                            myPlayer.id,
                            gameSession.chosenNumDivers,
                            cell.coords
                        )
                    )
                }
            } else if (gameSession.chosenSource) {
                if (gameSession.chosenNumDivers) {
                    if (isCenterCell) {
                        return HydratedHurl.canHurl(gameSession.gameState, myPlayer.id)
                    } else {
                        return HydratedFly.isValidFlightDestination(
                            gameSession.gameState,
                            myPlayer.id,
                            gameSession.chosenNumDivers,
                            false,
                            gameSession.chosenSource,
                            cell.coords
                        )
                    }
                }
            } else {
                return gameSession.gameState.board.sundiversForPlayer(myPlayer.id, cell).length > 0
            }
        } else if (myConvert) {
            if (gameSession.chosenConvertType === ConvertType.SolarGate) {
                return gameSession.diverCellChoices?.includes(coordinatesToNumber(cell.coords))
            } else if (gameSession.chosenConvertType === ConvertType.EnergyNode) {
                return gameSession.gameState.board.canConvertStationAt(
                    myPlayer.id,
                    StationType.EnergyNode,
                    cell.coords
                )
            } else if (gameSession.chosenConvertType === ConvertType.SundiverFoundry) {
                if (gameSession.diverCellChoices) {
                    return gameSession.diverCellChoices?.includes(coordinatesToNumber(cell.coords))
                }
                return gameSession.gameState.board.canConvertStationAt(
                    myPlayer.id,
                    StationType.SundiverFoundry,
                    cell.coords
                )
            } else if (gameSession.chosenConvertType === ConvertType.TransmitTower) {
                if (gameSession.diverCellChoices) {
                    return gameSession.diverCellChoices?.includes(coordinatesToNumber(cell.coords))
                }
                return gameSession.gameState.board.canConvertStationAt(
                    myPlayer.id,
                    StationType.TransmitTower,
                    cell.coords
                )
            }
        } else if (myActivate) {
            if (!gameSession.chosenSource && cell.station) {
                return HydratedActivate.canActivateStationAt(
                    gameSession.gameState,
                    myPlayer.id,
                    cell.coords
                )
            }
        }

        return false
    })

    let disabled = $derived(
        (myMove || (myConvert && gameSession.chosenConvertType) || myActivate) && !interactable
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

    function onClick() {
        if (!interactable) {
            return
        }

        if (myMove) {
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

                if (gameSession.numPlayerCanMoveFromSource() === 1) {
                    gameSession.chosenNumDivers = 1
                }
            }
        } else if (myConvert) {
            if (gameSession.diverCellChoices) {
                if (gameSession.chosenDiverCell) {
                    gameSession.chosenSecondDiverCell = cell.coords
                } else {
                    gameSession.chosenDiverCell = cell.coords
                }
                if (gameSession.chosenConvertType === ConvertType.SolarGate) {
                    gameSession.convertGate()
                } else if (gameSession.chosenConvertType === ConvertType.SundiverFoundry) {
                    gameSession.convertSundiverFoundry()
                } else if (gameSession.chosenConvertType === ConvertType.TransmitTower) {
                    gameSession.convertTransmitTower()
                }
            } else if (gameSession.chosenConvertType === ConvertType.EnergyNode) {
                gameSession.chosenSource = cell.coords
                gameSession.convertEnergyNode()
            } else if (gameSession.chosenConvertType === ConvertType.SundiverFoundry) {
                gameSession.chosenSource = cell.coords
                gameSession.convertSundiverFoundry()
            } else if (gameSession.chosenConvertType === ConvertType.TransmitTower) {
                gameSession.chosenSource = cell.coords
                gameSession.convertTransmitTower()
            }
        } else if (myActivate) {
            gameSession.chosenSource = cell.coords
            gameSession.activateStation()
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

    function getAnimator(playerId: string) {
        return new CellSundiverAnimator(gameSession, playerId, cell.coords)
    }

    // Pre-create animators for each player sundiver in this cell
    // to avoid creating them over and over due to reactivity
    const animatorPerPlayer = new Map<string, CellSundiverAnimator>()
    for (const player of gameSession.game.players) {
        animatorPerPlayer.set(
            player.id,
            new CellSundiverAnimator(gameSession, player.id, cell.coords)
        )
    }
</script>

{#each gameSession.game.players as player (player.id)}
    <Sundiver
        location={gameSession.locationForDiverInCell(player.id, cell) ?? { x: 0, y: 0 }}
        color={gameSession.colors.getPlayerColor(player.id)}
        quantity={numSundiversByPlayer.get(player.id)}
        animator={animatorPerPlayer.get(player.id)}
    />
{/each}

{#if cell.station}
    {#if cell.station.type === StationType.EnergyNode}
        <BoardSvg
            width={46}
            height={48}
            location={gameSession.locationForStationInCell(cell) ?? { x: 0, y: 0 }}
        >
            <EnergyNode
                width={46}
                height={48}
                color={gameSession.colors.getPlayerColor(cell.station.playerId)}
            />
        </BoardSvg>
    {:else if cell.station.type === StationType.SundiverFoundry}
        <BoardSvg
            width={46}
            height={48}
            location={gameSession.locationForStationInCell(cell) ?? { x: 0, y: 0 }}
        >
            <Foundry
                width={46}
                height={48}
                color={gameSession.colors.getPlayerColor(cell.station.playerId)}
            />
        </BoardSvg>
    {:else if cell.station.type === StationType.TransmitTower}
        <BoardSvg
            width={46}
            height={48}
            location={gameSession.locationForStationInCell(cell) ?? { x: 0, y: 0 }}
        >
            <Tower
                width={46}
                height={48}
                color={gameSession.colors.getPlayerColor(cell.station.playerId)}
            />
        </BoardSvg>
    {/if}
{/if}

<g
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
