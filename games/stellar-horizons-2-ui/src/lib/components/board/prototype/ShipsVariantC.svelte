<script lang="ts">
    // PROTOTYPE variant C: ships as pips on an orbit ring, one arc per faction; click for a drawer.
    import { FACTION_FILL } from '$lib/utils/presentation.js'
    import type { SystemFrame } from '$lib/utils/boardLayout.js'
    import { shipPrototype, type FactionGroup } from './prototypeState.svelte.js'

    let { frame, groups }: { frame: SystemFrame; groups: FactionGroup[] } = $props()
    const radius = $derived(frame.height * 0.2)
    const total = $derived(groups.reduce((sum, group) => sum + group.ships.length, 0))
    const pipRadius = $derived(
        Math.min(9, (Math.PI * radius) / Math.max(1, total + groups.length) - 1.5)
    )

    const arcs = $derived.by(() => {
        const step = (Math.PI * 2) / (total + groups.length)
        let angle = -Math.PI / 2
        return groups.map((group) => {
            const start = angle
            const pips = group.ships.map((ship, index) => {
                const a = start + index * step
                return { ship, x: Math.cos(a) * radius, y: Math.sin(a) * radius }
            })
            angle += (group.ships.length + 1) * step
            const mid = start + ((group.ships.length - 1) * step) / 2
            return {
                group,
                pips,
                labelX: Math.cos(mid) * (radius + 26),
                labelY: Math.sin(mid) * (radius + 26)
            }
        })
    })

    function toggle() {
        shipPrototype.drawerSystemId =
            shipPrototype.drawerSystemId === frame.systemId ? undefined : frame.systemId
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<g class="orbit" onclick={toggle}>
    <circle r={radius + 14} fill="rgba(0,0,0,0.001)"></circle>
    <circle r={radius} fill="none" stroke="rgba(127,211,255,0.25)" stroke-width="2"></circle>
    {#each arcs as arc (arc.group.faction)}
        {#each arc.pips as pip (pip.ship.shipId)}
            <circle
                cx={pip.x}
                cy={pip.y}
                r={pipRadius}
                fill={pip.ship.transit > 0 ? 'none' : FACTION_FILL[arc.group.faction]}
                stroke={FACTION_FILL[arc.group.faction]}
                stroke-width="2.5"
            ></circle>
        {/each}
        <text
            x={arc.labelX}
            y={arc.labelY + 7}
            text-anchor="middle"
            font-size="20"
            font-weight="800"
            fill={FACTION_FILL[arc.group.faction]}
            class="count">{arc.group.ships.length}</text
        >
    {/each}
</g>

<style>
    .orbit {
        cursor: pointer;
    }

    .count {
        paint-order: stroke;
        stroke: #000;
        stroke-width: 4px;
    }
</style>
