<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { UnitType, type Face } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { ArmyColors } from '$lib/utils/armyColors.js'

    let {
        at,
        rotation = 0,
        name,
        colors,
        count,
        faces = [],
        spent = false
    }: {
        at: Point
        rotation?: number
        name: string
        colors: ArmyColors
        count: number
        faces?: Face[]
        spent?: boolean
    } = $props()

    const gameSession = getGameSession()

    const scale = $derived(Math.min(3.2, Math.max(1, 0.62 / gameSession.zoom)))

    const TYPES = [UnitType.Infantry, UnitType.Cavalry, UnitType.Artillery]
    const TALLY_WIDTH = 27
    const tallies = $derived(
        faces.length === count
            ? TYPES.map((type) => ({
                  type,
                  count: faces.filter((face) => face.type === type).length
              })).filter((tally) => tally.count > 0)
            : []
    )
    const nameWidth = $derived(name.length * 7.4 + 16)
    const width = $derived(nameWidth + (tallies.length > 0 ? tallies.length * TALLY_WIDTH + 6 : 16))
</script>

<g
    transform="translate({at.x} {at.y}) rotate({-rotation}) scale({scale})"
    class="pointer-events-none"
    opacity={spent ? 0.6 : 1}
>
    <line x1="0" y1="0" x2="0" y2="-30" stroke="#3b3b3b" stroke-width="2"></line>
    <circle cx="0" cy="0" r="2.6" fill="#3b3b3b"></circle>
    <path d="M0 -30 h{width} l-7 9 l7 9 h{-width} z" fill="#f1ecdc"></path>
    <path d="M0 -30 h6 v18 h-6 z" fill={colors.block}></path>
    <text x="11" y="-16.5" font-size="13" font-style="italic" fill="#2b2620">{name}</text>
    {#each tallies as tally, index (tally.type)}
        <g transform="translate({nameWidth + index * TALLY_WIDTH} -21)">
            <rect
                x="0"
                y="-4.5"
                width="12"
                height="9"
                fill="none"
                stroke={colors.block}
                stroke-width="1.2"
            ></rect>
            {#if tally.type === UnitType.Infantry}
                <path d="M0 -4.5 L12 4.5 M0 4.5 L12 -4.5" stroke={colors.block} stroke-width="1.2"
                ></path>
            {:else if tally.type === UnitType.Cavalry}
                <path d="M0 4.5 L12 -4.5" stroke={colors.block} stroke-width="1.2"></path>
            {:else}
                <circle cx="6" cy="0" r="2" fill={colors.block}></circle>
            {/if}
            <text x="15" y="4.5" font-size="12" font-weight="700" fill={colors.block}
                >{tally.count}</text
            >
        </g>
    {/each}
    {#if tallies.length === 0}
        <text
            x={width - 9}
            y="-16.5"
            font-size="12"
            text-anchor="end"
            fill={colors.block}
            font-weight="700">{count}</text
        >
    {/if}
</g>
