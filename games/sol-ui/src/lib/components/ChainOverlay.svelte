<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { Point } from '@tabletop/common'
    import { offsetFromCenter, translateFromCenter } from '$lib/utils/boardGeometry.js'
    import { HydratedChain } from '@tabletop/sol'

    const CIRCLE_RADIUS = 25

    const gameSession = getContext('gameSession') as SolGameSession

    const locations: Point[] = $derived.by(() => {
        if (!gameSession.chain) {
            return []
        }

        const entriesWithSundivers = gameSession.chain.filter(
            (entry) => entry.sundiverId !== undefined
        )

        const locations = entriesWithSundivers
            .map((entry) => {
                const cell = gameSession.gameState.board.cellAt(entry.coords)
                const sundiver = cell.sundivers.find((diver) => diver.id === entry.sundiverId)
                if (!sundiver) {
                    return undefined
                }
                return gameSession.locationForDiverInCell(sundiver.playerId, cell)
            })
            .filter((loc) => loc !== undefined)

        return locations
    })

    function trimLineToCircleEdges(from: Point, to: Point, radius = CIRCLE_RADIUS) {
        const dx = to.x - from.x
        const dy = to.y - from.y
        const length = Math.hypot(dx, dy)

        if (length === 0) {
            return { from, to }
        }

        const offset = Math.min(radius, length / 2)
        const offsetX = (dx / length) * offset
        const offsetY = (dy / length) * offset

        return {
            from: { x: from.x + offsetX, y: from.y + offsetY },
            to: { x: to.x - offsetX, y: to.y - offsetY }
        }
    }

    const lines: { from: Point; to: Point }[] = $derived.by(() => {
        const locs = locations
        const segments: { from: Point; to: Point }[] = []
        for (let i = 0; i < locs.length - 1; i++) {
            segments.push(trimLineToCircleEdges(locs[i], locs[i + 1]))
        }
        return segments
    })

    const highlightEnds = $derived(
        gameSession.chain &&
            HydratedChain.isChainComplete(gameSession.gameState, gameSession.chain) &&
            !gameSession.chainStart
    )
</script>

{#each locations as location (location.x + ',' + location.y)}
    <g class="pointer-events-none" transform={translateFromCenter(location.x, location.y)}>
        <circle r={CIRCLE_RADIUS} fill="none" stroke="black" stroke-width={8}></circle>
    </g>
{/each}

<g class="pointer-events-none">
    {#each lines as line (line.from.x + ',' + line.from.y + '->' + line.to.x + ',' + line.to.y)}
        <line
            x1={offsetFromCenter(line.from).x}
            y1={offsetFromCenter(line.from).y}
            x2={offsetFromCenter(line.to).x}
            y2={offsetFromCenter(line.to).y}
            stroke="black"
            stroke-width={8}
        ></line>
    {/each}
</g>

{#each locations as location, index (location.x + ',' + location.y)}
    <g class="pointer-events-none" transform={translateFromCenter(location.x, location.y)}>
        <circle
            r={CIRCLE_RADIUS}
            fill="none"
            stroke={highlightEnds && (index === 0 || index === locations.length - 1)
                ? 'yellow'
                : 'white'}
            stroke-width={5}
        ></circle>
    </g>
{/each}

<g class="pointer-events-none">
    {#each lines as line (line.from.x + ',' + line.from.y + '->' + line.to.x + ',' + line.to.y)}
        <line
            x1={offsetFromCenter(line.from).x}
            y1={offsetFromCenter(line.from).y}
            x2={offsetFromCenter(line.to).x}
            y2={offsetFromCenter(line.to).y}
            stroke="white"
            stroke-width={5}
        ></line>
    {/each}
</g>
