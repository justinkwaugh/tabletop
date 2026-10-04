<script lang="ts">
    // PROTOTYPE variant A: one tally badge per faction; hover shows that faction's counters.
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { FACTION_FILL } from '$lib/utils/presentation.js'
    import type { SystemFrame } from '$lib/utils/boardLayout.js'
    import { shipPrototype, type FactionGroup } from './prototypeState.svelte.js'

    let { frame, groups }: { frame: SystemFrame; groups: FactionGroup[] } = $props()
    const W = 122
    const H = 52
    const GAP = 8
    const COLUMNS = 3

    function position(index: number) {
        const row = Math.floor(index / COLUMNS)
        const inRow = Math.min(COLUMNS, groups.length - row * COLUMNS)
        const column = index % COLUMNS
        return {
            x: -(inRow * W + (inRow - 1) * GAP) / 2 + column * (W + GAP),
            y: frame.height * 0.04 + row * (H + GAP)
        }
    }
</script>

{#each groups as group, index (group.faction)}
    {@const at = position(index)}
    {@const moving = group.ships.filter((ship) => ship.transit > 0).length}
    {@const cargo = group.ships.reduce((sum, ship) => sum + ship.settlements, 0)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g
        transform="translate({at.x} {at.y})"
        class="tally"
        onmouseenter={() =>
            (shipPrototype.hover = { systemId: frame.systemId, faction: group.faction })}
        onmouseleave={() => (shipPrototype.hover = undefined)}
    >
        <rect
            width={W}
            height={H}
            rx="10"
            fill="rgba(6,10,20,0.88)"
            stroke={FACTION_FILL[group.faction]}
            stroke-width="3"
        ></rect>
        <image href={FACTION_ART[group.faction]} x="5" y="5" width={H - 10} height={H - 10}></image>
        <text x={H + 2} y="31" font-size="28" font-weight="800" fill="#fff"
            >{group.ships.length}</text
        >
        <text x={H + 34} y="22" font-size="15" fill="#f2c94c">{moving > 0 ? `➜${moving}` : ''}</text
        >
        <text x={H + 34} y="42" font-size="15" fill="#e8e2d0">{cargo > 0 ? `◉${cargo}` : ''}</text>
    </g>
{/each}

<style>
    .tally {
        cursor: pointer;
    }
</style>
