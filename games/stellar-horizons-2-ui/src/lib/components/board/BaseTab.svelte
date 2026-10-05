<script lang="ts">
    import type { BaseTab } from '$lib/utils/baseTabLayout.js'
    import { FACTION_FILL, factionName, plural } from '$lib/utils/presentation.js'

    let { tab }: { tab: BaseTab } = $props()
    const points = $derived(tab.points.map(({ x, y }) => `${x},${y}`).join(' '))
</script>

<g class="base-tab" class:winning={tab.base.winning}>
    <title
        >{factionName(tab.base.faction)}: {plural(tab.base.settlements, 'settlement')}{tab.base
            .winning
            ? ', enough to win'
            : ''}</title
    >
    <polygon {points} fill={FACTION_FILL[tab.base.faction]}></polygon>
    <text x={tab.label.x} y={tab.label.y} text-anchor="middle">{tab.base.settlements}</text>
</g>

<style>
    polygon {
        stroke: rgba(0, 0, 0, 0.75);
        stroke-width: 1.5px;
        stroke-linejoin: round;
    }

    .winning polygon {
        stroke: #ffd65a;
        stroke-width: 3px;
    }

    text {
        font-size: 19px;
        font-weight: 900;
        fill: #ffffff;
        paint-order: stroke;
        stroke: rgba(0, 0, 0, 0.7);
        stroke-width: 3px;
    }
</style>
