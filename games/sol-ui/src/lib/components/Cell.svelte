<script lang="ts">
    import { getContext } from 'svelte'
    import { SvelteMap } from 'svelte/reactivity'
    import '$lib/styles/focusable-control.css'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { sameCoordinates } from '@tabletop/common'
    import {
        dimensionsForSpace,
        getCirclePoint,
        toRadians,
        translateFromCenter
    } from '$lib/utils/boardGeometry.js'
    import { getCellLayout } from '$lib/utils/cellLayouts.js'
    import { Direction, HydratedConvert, HydratedFly, type Cell } from '@tabletop/sol'
    import { ActionCategory } from '$lib/definition/actionCategory.js'
    import Sundiver from './Sundiver.svelte'
    import { CellSundiverAnimator } from '$lib/animators/cellSundiverAnimator.js'
    import { ConvertType } from '$lib/definition/convertType.js'

    let { cell }: { cell: Cell } = $props()
    const gameSession = getContext('gameSession') as SolGameSession
    const dimensions = dimensionsForSpace(gameSession.numPlayers, cell.coords)
    const cellLayout = getCellLayout(cell, gameSession.numPlayers, gameSession.gameState.board)

    let myMove = $derived(
        gameSession.isMyTurn && gameSession.chosenActionCategory === ActionCategory.Move
    )

    let myConvert = $derived(
        gameSession.isMyTurn && gameSession.chosenActionCategory === ActionCategory.Convert
    )

    let interactable = $derived.by(() => {
        const myPlayer = gameSession.myPlayer
        if (!myPlayer || (!myMove && !myConvert)) {
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
                    return HydratedFly.isValidFlightDestination(
                        gameSession.gameState,
                        myPlayer.id,
                        gameSession.chosenNumDivers,
                        false,
                        gameSession.chosenSource,
                        cell.coords
                    )
                }
            } else {
                return gameSession.gameState.board.sundiversForPlayer(myPlayer.id, cell).length > 0
            }
        }

        return false
    })

    let disabled = $derived((myMove || myConvert) && !interactable)

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

        if (gameSession.chosenActionCategory === ActionCategory.Move) {
            if (gameSession.chosenMothership) {
                gameSession.chosenDestination = cell.coords
                gameSession.launch()
            } else if (gameSession.chosenSource) {
                gameSession.chosenDestination = cell.coords
                gameSession.fly()
            } else {
                gameSession.chosenSource = cell.coords

                if (gameSession.numPlayerCanMoveFromSource() === 1) {
                    gameSession.chosenNumDivers = 1
                }
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
    <path
        d={cellPath(
            dimensions.innerRadius,
            dimensions.outerRadius,
            dimensions.startDegrees,
            dimensions.endDegrees
        )}
        fill="transparent"
    ></path>
</g>

{#if disabled}
    <g transform={translateFromCenter(0, 0)} stroke="none">
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
    </g>
{/if}
