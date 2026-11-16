<script lang="ts">
    import type { HexId } from '@tabletop/ride-the-rails'
    import { hexCenter } from '$lib/utils/boardGeometry.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import { BONUS_PILL } from '$lib/utils/cityMarks.js'
    import {
        insetHexPoints,
        pickScale,
        type LitHexView,
        type MarkTone
    } from '$lib/utils/pickMarks.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import GhostCube from './GhostCube.svelte'

    let {
        views,
        viewScale,
        journeyFrom
    }: { views: readonly LitHexView[]; viewScale: number; journeyFrom?: HexId } = $props()

    // R-3.3.2: a chevron points west when its city lies west of the city the link leaves from.
    function westOfJourney(hexId: HexId): boolean {
        return journeyFrom !== undefined && hexCenter(hexId).x < hexCenter(journeyFrom).x
    }

    // Rings and marks keep a readable screen size at any zoom; ghost cubes stand in their slots.
    const scale = $derived(pickScale(viewScale))

    // A lit hex: no ring, only its hole in the scrim; the picked one an amber ring on a dark
    // edge, tinted. A city lit for a start only keeps a fainter amber ring further out, so extensions
    // stand out.
    const LIT_INSET = 5
    const JOURNEY_START_INSET = 4
    const MARK_HEIGHT = 18.4
    // A journey's next-city chevrons: this much bigger than drawn, this far apart.
    const CHEVRON_SCALE = 1.7
    const CHEVRON_STEP = 36

    const RING_WIDTHS = {
        picked: { edge: 6.4, bright: 4 }
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
        {#if view.ring === 'lit' || view.ring === 'start'}
            <!-- A lit hex, a start one too: a hole in the scrim, and the mark BOARD_LOOK.litHex
                 picks. -->
            {#if BOARD_LOOK.litHex === 'thin-ring'}
                <polygon
                    points={insetHexPoints(view.hexId, 3.5)}
                    fill="none"
                    stroke="var(--rtr-white)"
                    stroke-width={2.6 * scale}
                    stroke-linejoin="round"
                    data-ring={view.ring}
                ></polygon>
            {/if}
        {:else if view.ring === 'picked'}
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
        {@const gains = view.marks.filter((mark) => mark.tone !== 'cost')}
        {#each view.marks as mark (mark.tone)}
            {@const width = (mark.text.length > 2 ? 30 : 22) * scale}
            {@const index = gains.indexOf(mark)}
            <!-- R-3.2.4: the mountain's −1 at the bottom centre, where a city's bonus pill sits;
                 a gain up and left of the centre. -->
            {@const x = mark.tone === 'cost' ? center.x : center.x - (18.8 + index * 18) * scale}
            {@const y =
                mark.tone === 'cost'
                    ? center.y + BONUS_PILL.center.y
                    : center.y - (22 + index * 5) * scale}
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
        <!-- Large and centred on the city, side by side where more than one railroad links it. -->
        {#each view.chevrons as railroadId, index (railroadId)}
            {@const style = railroadStyle(railroadId)}
            {@const across = (index - (view.chevrons.length - 1) / 2) * CHEVRON_STEP}
            <g
                transform="translate({center.x + across * scale} {center.y}) scale({scale *
                    CHEVRON_SCALE})"
                data-chevron={railroadId}
            >
                <circle r="9.8" fill={style.fill} stroke="var(--rtr-halo)" stroke-width="2"
                ></circle>
                <path
                    d="M-2.2 -4.6L2.6 0L-2.2 4.6"
                    transform={westOfJourney(view.hexId) ? 'scale(-1 1)' : undefined}
                    fill="none"
                    stroke={style.ink}
                    stroke-width="2.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                ></path>
            </g>
        {/each}
    {/each}
    <!-- The journey's start besides its ring (BOARD_LOOK.journeyStart): a navy pennant on a
         white-edged pole up and left of the centre, or a navy badge with a white pennant in the
         hex's top left, or the ring alone. -->
    {#each BOARD_LOOK.journeyStart === 'ring-only' ? [] : starts as view (view.hexId)}
        {@const center = hexCenter(view.hexId)}
        {#if BOARD_LOOK.journeyStart === 'badge'}
            <g
                transform="translate({center.x - 15} {center.y - 21}) scale({scale})"
                data-start-flag
            >
                <circle r="10.5" fill="var(--rtr-pill)" stroke="var(--rtr-white)" stroke-width="2"
                ></circle>
                <path
                    d="M-3.6 6V-6.2"
                    stroke="var(--rtr-white)"
                    stroke-width="1.8"
                    stroke-linecap="round"
                ></path>
                <path d="M-3 -6.2L6 -2.6L-3 1Z" fill="var(--rtr-white)"></path>
            </g>
        {:else}
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
        {/if}
    {/each}
</g>
