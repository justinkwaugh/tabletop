<script lang="ts">
    import { isCityHex } from '@tabletop/ride-the-rails'
    import { hexCenter } from '$lib/utils/boardGeometry.js'
    import {
        insetHexPoints,
        pickScale,
        type LitHexView,
        type MarkTone
    } from '$lib/utils/pickMarks.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'

    let { views, viewScale }: { views: readonly LitHexView[]; viewScale: number } = $props()

    // Rings, pips and marks keep a readable screen size at any zoom.
    const scale = $derived(pickScale(viewScale))

    const RING_INSET = 3
    const PIP_RADIUS = 6.6
    const PIP_GAP = 14.8
    const MARK_HEIGHT = 18.4

    const MARK_FILL: Readonly<Record<MarkTone, string>> = {
        coin: 'var(--rtr-coin)',
        five: 'var(--rtr-five)',
        gold: 'var(--rtr-gold)',
        cost: 'var(--rtr-cost)'
    }

    function pipRise(view: LitHexView): number {
        return isCityHex(view.hexId) ? 29.2 : 19
    }
</script>

<!-- Contract, Pick conventions: lit and picked rings, railroad pips, and one mark per gain or cost. -->
<g class="picks" aria-hidden="true">
    {#each views as view (view.hexId)}
        {@const picked = view.ring === 'picked'}
        {@const ring = insetHexPoints(view.hexId, RING_INSET)}
        <polygon
            points={ring}
            fill="var(--rtr-accent-fill)"
            stroke="var(--rtr-halo)"
            stroke-width={(picked ? 10.4 : 7.2) * scale}
            stroke-linejoin="round"
        ></polygon>
        <polygon
            points={ring}
            fill="none"
            stroke={view.ring === 'start' ? 'var(--rtr-accent-start)' : 'var(--rtr-accent)'}
            stroke-width={(picked ? 6.8 : 3.8) * scale}
            stroke-linejoin="round"
        ></polygon>
    {/each}
    {#each views as view (view.hexId)}
        {@const center = hexCenter(view.hexId)}
        {#each view.pips as pip, index (pip.railroadId)}
            {@const style = railroadStyle(pip.railroadId)}
            {@const x = center.x + (index - (view.pips.length - 1) / 2) * PIP_GAP * scale}
            {@const y = center.y - pipRise(view) * scale}
            <circle
                cx={x}
                cy={y}
                r={PIP_RADIUS * scale}
                fill={pip.hollow ? 'var(--rtr-station)' : style.fill}
                stroke={pip.hollow ? style.fill : 'var(--rtr-halo)'}
                stroke-width={(pip.hollow ? 3 : 1.4) * scale}
            ></circle>
            <text
                {x}
                y={y + 3.2 * scale}
                font-size={8.8 * scale}
                font-weight="800"
                text-anchor="middle"
                fill={pip.hollow ? style.hollowInk : style.ink}>{style.monogram}</text
            >
        {/each}
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
                fill={mark.tone === 'coin' ? 'var(--rtr-halo)' : 'var(--rtr-station)'}
                >{mark.text}</text
            >
        {/each}
    {/each}
</g>
