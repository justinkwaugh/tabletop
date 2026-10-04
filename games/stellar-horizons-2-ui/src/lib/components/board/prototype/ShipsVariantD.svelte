<script lang="ts">
    // PROTOTYPE variant D: a small fanned stack of real counters per faction; hover fans it out.
    import { SHIP_ART } from '$lib/art/manifest.js'
    import { FACTION_FILL } from '$lib/utils/presentation.js'
    import type { SystemFrame } from '$lib/utils/boardLayout.js'
    import { shipPrototype, type FactionGroup } from './prototypeState.svelte.js'

    let { frame, groups }: { frame: SystemFrame; groups: FactionGroup[] } = $props()
    const CW = 64
    const CH = (CW * 172) / 208
    const CELL_W = 118
    const CELL_H = 80
    const COLUMNS = 3

    function position(index: number) {
        const row = Math.floor(index / COLUMNS)
        const inRow = Math.min(COLUMNS, groups.length - row * COLUMNS)
        const column = index % COLUMNS
        return { x: -(inRow * CELL_W) / 2 + column * CELL_W, y: frame.height * 0.02 + row * CELL_H }
    }
</script>

{#each groups as group, index (group.faction)}
    {@const at = position(index)}
    {@const shown = group.ships.slice(0, 4)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g
        transform="translate({at.x} {at.y})"
        class="stack"
        onmouseenter={() =>
            (shipPrototype.hover = { systemId: frame.systemId, faction: group.faction })}
        onmouseleave={() => (shipPrototype.hover = undefined)}
    >
        {#each shown as ship, depth (ship.shipId)}
            <image
                href={SHIP_ART[ship.shipId]}
                x={depth * 8}
                y={(shown.length - 1 - depth) * 5}
                width={CW}
                height={CH}
            ></image>
        {/each}
        <circle
            cx={CW + (shown.length - 1) * 8 + 4}
            cy="10"
            r="15"
            fill={FACTION_FILL[group.faction]}
            stroke="#000"
            stroke-width="2"
        ></circle>
        <text
            x={CW + (shown.length - 1) * 8 + 4}
            y="17"
            text-anchor="middle"
            font-size="19"
            font-weight="800"
            fill="#fff">{group.ships.length}</text
        >
    </g>
{/each}

<style>
    .stack {
        cursor: pointer;
    }
</style>
