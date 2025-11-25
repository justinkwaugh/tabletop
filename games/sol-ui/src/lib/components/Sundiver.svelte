<script lang="ts">
    import SundiverIcon from '$lib/images/sundiver.svelte'
    import SundiverMask from '$lib/images/sundiverMask.svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
    import { move } from '$lib/utils/animations.js'
    import {
        getMothershipSpotPoint,
        offsetFromCenter,
        translateFromCenter
    } from '$lib/utils/boardGeometry.js'
    import { getCellLayout } from '$lib/utils/cellLayouts.js'
    import { sameCoordinates, type Point } from '@tabletop/common'
    import type { HydratedSolGameState, Sundiver } from '@tabletop/sol'
    import { getContext, onMount } from 'svelte'
    import { gsap } from 'gsap'

    let {
        id,
        color,
        quantity,
        location,
        onclick
    }: { id?: string; color: string; quantity: number; location?: Point; onclick?: () => void } =
        $props()

    let gameSession = getContext('gameSession') as SolGameSession

    let diverElement: SVGElement

    let onClick = () => {
        if (onclick) {
            onclick()
        }
    }

    export function getId() {
        return id
    }

    export function animateTo(
        newLocation: Point,
        duration: number = 0.5,
        timeline?: gsap.core.Timeline
    ) {
        move({
            object: diverElement,
            location: newLocation,
            duration,
            timeline,
            position: 'movingPieces'
        })
    }

    function getMothershipLocationForPlayer(
        gameState: HydratedSolGameState,
        playerId: string
    ): Point {
        const mothershipIndex = gameState.board.motherships[playerId]
        const spotPoint = getMothershipSpotPoint(gameState.players.length, mothershipIndex)

        return {
            x: spotPoint.x,
            y: spotPoint.y
        }
    }

    async function onGameStateChange({
        to,
        from,
        timeline
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        timeline: gsap.core.Timeline
    }) {
        const toSundiver: Sundiver | undefined = Iterator.from(to.getAllSundivers()).find(
            (d) => d.id === id
        )
        const fromSundiver: Sundiver | undefined = Iterator.from(
            from?.getAllSundivers() ?? []
        ).find((d) => d.id === id)

        let fromLocation: Point | undefined
        let toLocation: Point | undefined
        let fadeOut = false

        // Figure out where we are going
        if (toSundiver) {
            // In a cell
            if (toSundiver.coords) {
                if (sameCoordinates(fromSundiver?.coords, toSundiver.coords)) {
                    return
                }
                const cell = to.board.cellAt(toSundiver.coords)
                if (cell) {
                    const cellLayout = getCellLayout(cell, to.players.length, to.board)
                    toLocation = cellLayout.divers[0]
                }
                // In a hold
            } else if (toSundiver.hold) {
                if (fromSundiver?.hold === toSundiver.hold) {
                    return
                }
                toLocation = getMothershipLocationForPlayer(to, toSundiver.hold)
                fadeOut = true
            }
        }

        if (fromSundiver) {
            if (fromSundiver.coords) {
                const fromCell = from?.board.cellAt(fromSundiver.coords)
                if (fromCell) {
                    const fromCellLayout = getCellLayout(fromCell, to.players.length, to.board)
                    fromLocation = fromCellLayout.divers[0]
                }
            } else if (fromSundiver.hold) {
                fromLocation = getMothershipLocationForPlayer(from!, fromSundiver.hold)
            }
        }

        if (fromLocation) {
            console.log('set sundiver ', id, 'to', fromLocation)
            const changes = Object.assign({}, offsetFromCenter(fromLocation), {
                opacity: 1
            })
            gsap.set(diverElement, changes)
        }

        if (toLocation) {
            console.log('animate sundiver ', id, 'to', toLocation)
            animateTo(offsetFromCenter(toLocation), 0.5, timeline)
        }
        if (fadeOut) {
            timeline.to(diverElement, {
                opacity: 0,
                duration: 0.3,
                position: '>'
            })
        }
    }

    onMount(() => {
        if (!id) {
            return
        }
        gameSession.addGameStateChangeListener(onGameStateChange)
        return () => {
            gameSession.removeGameStateChangeListener(onGameStateChange)
        }
    })
</script>

<g
    bind:this={diverElement}
    on:click={onClick}
    transform={translateFromCenter(location?.x ?? 0, location?.y ?? 0)}
>
    <g transform="scale(.8) translate(-19, -25)">
        <g transform="translate(-1, -1)">
            <SundiverMask
                width="40"
                height="52"
                fill={'black'}
                opacity=".5"
                overflow="visible"
                style="filter: url(#divershadow)"
            />
        </g>
        <SundiverIcon class={color} />
    </g>
    {#if quantity > 1}
        <g transform="translate(0,0)">
            <text
                class="select-none pointer-events-none"
                style="filter: url(#textshadow); fill: black;"
                y="1"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="23"
                font-weight="bold"
                stroke-width="1"
                stroke="#000000"
                opacity=".5"
                fill="black">{quantity}</text
            >
            <text
                y="1"
                class="select-none pointer-events-none"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="23"
                font-weight="bold"
                stroke-width="1"
                stroke="#FFFFFF"
                fill="white"
                >{quantity}
            </text>
        </g>
    {/if}
</g>
