<script lang="ts">
    import { hexCenter } from '$lib/utils/boardGeometry.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import {
        insetHexPoints,
        pickScale,
        type LitHexView,
        type MarkTone
    } from '$lib/utils/pickMarks.js'
    import GhostCube from './GhostCube.svelte'

    let { views, viewScale }: { views: readonly LitHexView[]; viewScale: number } = $props()

    // Rings and marks keep a readable screen size at any zoom; ghost cubes stand in their slots.
    const scale = $derived(pickScale(viewScale))

    // One amber ring just inside the hex, heavier on the picked hex; no dark halo.
    const RING_INSET = 3.5
    const MARK_HEIGHT = 18.4

    const MARK_FILL: Readonly<Record<MarkTone, string>> = {
        coin: 'var(--rtr-coin)',
        five: 'var(--rtr-five)',
        gold: 'var(--rtr-gold)',
        cost: 'var(--rtr-cost)'
    }
</script>

<!-- Contract, Pick conventions: lit and picked rings, a ghost cube for each railroad that may build,
     and one mark per gain or cost. -->
<g class="picks" aria-hidden="true">
    {#each views as view (view.hexId)}
        <polygon
            points={insetHexPoints(view.hexId, RING_INSET)}
            fill="var(--rtr-accent-fill)"
            stroke={view.ring === 'start' ? 'var(--rtr-accent-start)' : 'var(--rtr-lit-ring)'}
            stroke-width={(view.ring === 'picked' ? 5.6 : 4) * scale}
            stroke-linejoin="round"
        ></polygon>
    {/each}
    {#if BOARD_LOOK.litRailroads === 'ghost-cube'}
        {#each views as view (view.hexId)}
            {#each view.ghosts as ghost (ghost.railroadId)}
                <GhostCube {ghost} />
            {/each}
        {/each}
    {/if}
    {#each views as view (view.hexId)}
        {@const center = hexCenter(view.hexId)}
        {#each view.marks as mark, index (mark.tone)}
            {@const width = (mark.text.length > 2 ? 30 : 22) * scale}
            {@const x = center.x + (18.8 + index * 18) * scale}
            {@const y = center.y + (22 + index * 5) * scale}
            <rect
                x={x - width / 2}
                y={y - (MARK_HEIGHT * scale) / 2}
                {width}
                height={MARK_HEIGHT * scale}
                rx={(MARK_HEIGHT * scale) / 2}
                fill={MARK_FILL[mark.tone]}
                stroke="var(--rtr-halo)"
                stroke-width={2.6 * scale}
            ></rect>
            <text
                {x}
                y={y + 4.2 * scale}
                font-size={12.4 * scale}
                font-weight="800"
                text-anchor="middle"
                fill={mark.tone === 'coin' ? 'var(--rtr-halo)' : 'var(--rtr-white)'}
                >{mark.text}</text
            >
        {/each}
    {/each}
</g>
