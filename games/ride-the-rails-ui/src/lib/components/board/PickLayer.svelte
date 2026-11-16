<script lang="ts">
    import { hexCenter } from '$lib/utils/boardGeometry.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import {
        insetHexPoints,
        pickScale,
        type LitHexView,
        type MarkTone
    } from '$lib/utils/pickMarks.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import GhostCube from './GhostCube.svelte'

    let { views, viewScale }: { views: readonly LitHexView[]; viewScale: number } = $props()

    // Rings and marks keep a readable screen size at any zoom; ghost cubes stand in their slots.
    const scale = $derived(pickScale(viewScale))

    // A lit or picked hex: a bright amber ring on a dark edge just inside the hex; a city lit for
    // a start only keeps a fainter amber ring further out, so extensions stand out.
    const LIT_INSET = 5
    const START_INSET = 3.5
    const JOURNEY_START_INSET = 4
    const MARK_HEIGHT = 18.4

    const RING_WIDTHS = {
        lit: { edge: 8.8, bright: 5.6 },
        picked: { edge: 10.4, bright: 7.2 }
    } as const

    const MARK_FILL: Readonly<Record<MarkTone, string>> = {
        coin: 'var(--rtr-coin)',
        five: 'var(--rtr-five)',
        gold: 'var(--rtr-gold)',
        cost: 'var(--rtr-cost)'
    }

    const starts = $derived(views.filter((view) => view.ring === 'journey-start'))
</script>

<!-- Contract, Pick conventions: lit and picked rings, a journey's start ringed and flagged in navy,
     a ghost cube for each railroad that may build, one mark per gain or cost, and a chevron per
     railroad on a journey's next city. -->
<g class="picks" aria-hidden="true">
    {#each views as view (view.hexId)}
        {#if view.ring === 'lit' || view.ring === 'picked'}
            {@const widths = RING_WIDTHS[view.ring]}
            <polygon
                points={insetHexPoints(view.hexId, LIT_INSET)}
                fill="var(--rtr-lit-fill)"
                stroke="var(--rtr-halo)"
                stroke-width={widths.edge * scale}
                stroke-linejoin="round"
                data-ring={view.ring}
            ></polygon>
            <polygon
                points={insetHexPoints(view.hexId, LIT_INSET)}
                fill="none"
                stroke="var(--rtr-lit-bright)"
                stroke-width={widths.bright * scale}
                stroke-linejoin="round"
            ></polygon>
        {:else if view.ring === 'start'}
            <polygon
                points={insetHexPoints(view.hexId, START_INSET)}
                fill="var(--rtr-accent-fill)"
                stroke="var(--rtr-accent-start)"
                stroke-width={4 * scale}
                stroke-linejoin="round"
                data-ring={view.ring}
            ></polygon>
        {:else}
            <polygon
                points={insetHexPoints(view.hexId, JOURNEY_START_INSET)}
                fill="none"
                stroke="var(--rtr-white)"
                stroke-width={8.4 * scale}
                stroke-linejoin="round"
                data-ring={view.ring}
            ></polygon>
            <polygon
                points={insetHexPoints(view.hexId, JOURNEY_START_INSET)}
                fill="none"
                stroke="var(--rtr-pill)"
                stroke-width={4.4 * scale}
                stroke-linejoin="round"
            ></polygon>
        {/if}
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
        <!-- R-3.3.2: "link by Red": a disc in each railroad's colour with a chevron in its ink. -->
        {#each view.chevrons as railroadId, index (railroadId)}
            {@const style = railroadStyle(railroadId)}
            <g
                transform="translate({center.x + (20 + 17 * index) * scale} {center.y +
                    21 * scale}) scale({scale})"
                data-chevron={railroadId}
            >
                <circle r="9.8" fill={style.fill} stroke="var(--rtr-halo)" stroke-width="2.4"
                ></circle>
                <path
                    d="M-2.2 -4.6L2.6 0L-2.2 4.6"
                    fill="none"
                    stroke={style.ink}
                    stroke-width="2.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                ></path>
            </g>
        {/each}
    {/each}
    <!-- The journey's start flag: a navy pennant on a white-edged pole, up and left of the centre. -->
    {#each starts as view (view.hexId)}
        {@const center = hexCenter(view.hexId)}
        <g transform="translate({center.x} {center.y})" data-start-flag>
            <path
                d="M-25 -2V-38"
                stroke="var(--rtr-white)"
                stroke-width={5 * scale}
                stroke-linecap="round"
            ></path>
            <path
                d="M-25 -2V-38"
                stroke="var(--rtr-pill)"
                stroke-width={2.6 * scale}
                stroke-linecap="round"
            ></path>
            <path
                d="M-24 -39L-7 -31.5L-24 -24Z"
                fill="var(--rtr-pill)"
                stroke="var(--rtr-white)"
                stroke-width={1.8 * scale}
                stroke-linejoin="round"
            ></path>
        </g>
    {/each}
</g>
