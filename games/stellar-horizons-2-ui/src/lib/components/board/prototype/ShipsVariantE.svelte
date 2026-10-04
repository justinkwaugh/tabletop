<script lang="ts">
    // PROTOTYPE variant E: pips on orbit arcs in the gaps between worlds; overflow clumps inward.
    // Pips shrink per system only as far as needed to fit every ship.
    import type { SystemFrame } from '$lib/utils/boardLayout.js'
    import { shipPrototype, type FactionGroup } from './prototypeState.svelte.js'
    import {
        factionSequence,
        fitPips,
        flowAcrossRings,
        obstacles,
        ringPositions,
        ringRadii
    } from './pipLayout.js'
    import Pip from './Pip.svelte'

    let { frame, groups }: { frame: SystemFrame; groups: FactionGroup[] } = $props()
    const layout = $derived.by(() => {
        const blocked = obstacles(frame)
        const sequence = factionSequence(groups)
        const total = groups.reduce((sum, group) => sum + group.ships.length, 0)
        return fitPips(total, (r) => {
            const rings = ringRadii(frame, r).map((radius) =>
                ringPositions(radius, blocked, frame, r)
            )
            return flowAcrossRings(sequence, rings)
        })
    })

    function toggle() {
        shipPrototype.drawerSystemId =
            shipPrototype.drawerSystemId === frame.systemId ? undefined : frame.systemId
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<g class="pips" onclick={toggle}>
    {#each layout.pips as pip (pip.ship.shipId)}
        <Pip ship={pip.ship} x={pip.x} y={pip.y} r={layout.r} />
    {/each}
</g>

<style>
    .pips {
        cursor: pointer;
    }
</style>
