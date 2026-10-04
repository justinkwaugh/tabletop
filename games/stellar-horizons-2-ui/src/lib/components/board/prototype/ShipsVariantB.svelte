<script lang="ts">
    // PROTOTYPE variant B: every ship as a tiny faction-coloured chip, one row per faction.
    import { ShipKind, shipDefinition } from '@tabletop/stellar-horizons-2'
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { FACTION_FILL } from '$lib/utils/presentation.js'
    import type { SystemFrame } from '$lib/utils/boardLayout.js'
    import { shipPrototype, type FactionGroup } from './prototypeState.svelte.js'

    let { frame, groups }: { frame: SystemFrame; groups: FactionGroup[] } = $props()
    const CHIP_W = 42
    const CHIP_H = 26
    const GAP = 4
    const ROW = 30
    const EMBLEM = 26
    const width = $derived(
        EMBLEM + 6 + Math.max(...groups.map((group) => group.ships.length)) * (CHIP_W + GAP)
    )
    const top = $derived(frame.height * 0.48 - groups.length * ROW)

    function label(shipId: string) {
        const ship = shipDefinition(shipId)
        return ship.kind === ShipKind.RE ? 'RE' : `CV${ship.size}`
    }
</script>

{#each groups as group, row (group.faction)}
    <g transform="translate({-width / 2} {top + row * ROW})">
        <image href={FACTION_ART[group.faction]} width={EMBLEM} height={EMBLEM}></image>
        {#each group.ships as ship, index (ship.shipId)}
            {@const x = EMBLEM + 6 + index * (CHIP_W + GAP)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <g
                transform="translate({x} 0)"
                class="chip"
                onmouseenter={() =>
                    (shipPrototype.hover = { systemId: frame.systemId, shipId: ship.shipId })}
                onmouseleave={() => (shipPrototype.hover = undefined)}
            >
                <rect
                    width={CHIP_W}
                    height={CHIP_H}
                    rx="5"
                    fill={FACTION_FILL[group.faction]}
                    opacity={ship.transit > 0 ? 0.45 : 1}
                    stroke={ship.transit > 0 ? '#f2c94c' : 'rgba(0,0,0,0.5)'}
                    stroke-width="2"
                    stroke-dasharray={ship.transit > 0 ? '4 3' : undefined}
                ></rect>
                <text
                    x={CHIP_W / 2}
                    y="18"
                    text-anchor="middle"
                    font-size="14"
                    font-weight="800"
                    fill="#fff"
                    class="chip-text">{label(ship.shipId)}</text
                >
                {#if ship.damage > 0}
                    <rect x={CHIP_W - 9} y="0" width="9" height="9" fill="#e53935"></rect>
                {/if}
                {#if ship.settlements > 0}
                    <circle cx="6" cy={CHIP_H - 5} r="4" fill="#f5f1e6"></circle>
                {/if}
            </g>
        {/each}
    </g>
{/each}

<style>
    .chip {
        cursor: pointer;
    }

    .chip-text {
        paint-order: stroke;
        stroke: rgba(0, 0, 0, 0.6);
        stroke-width: 3px;
    }
</style>
