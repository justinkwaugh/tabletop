<script lang="ts">
    // PROTOTYPE variant G: radius shows arrival time. Arrived ships on the outer free ring,
    // ships 1, 2, 3... turns out on successive inner rings (spilling inward if a ring fills).
    import type { SystemFrame } from '$lib/utils/boardLayout.js'
    import { shipPrototype, type FactionGroup } from './prototypeState.svelte.js'
    import {
        fitPips,
        flowAcrossRings,
        obstacles,
        ringPositions,
        ringRadii,
        type PlacedPip
    } from './pipLayout.js'
    import Pip from './Pip.svelte'

    let { frame, groups }: { frame: SystemFrame; groups: FactionGroup[] } = $props()
    const layout = $derived.by(() => {
        const blocked = obstacles(frame)
        const ships = groups.flatMap((group) => group.ships)
        const turns = [...new Set(ships.map((ship) => ship.transit))].sort((a, b) => a - b)
        return fitPips(ships.length, (r) => {
            const rings = ringRadii(frame, r).map((radius) =>
                ringPositions(radius, blocked, frame, r)
            )
            const placed: PlacedPip[] = []
            let ringIndex = 0
            for (const turn of turns) {
                const sequence = groups.flatMap((group) =>
                    group.ships.filter((ship) => ship.transit === turn)
                )
                placed.push(...flowAcrossRings(sequence, rings.slice(ringIndex)))
                let capacity = 0
                let consumed = 0
                while (capacity < sequence.length && ringIndex + consumed < rings.length) {
                    capacity += rings[ringIndex + consumed].length
                    consumed++
                }
                ringIndex += Math.max(1, consumed)
            }
            return placed
        })
    })

    function toggle() {
        shipPrototype.drawerSystemId =
            shipPrototype.drawerSystemId === frame.systemId ? undefined : frame.systemId
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<g class="lanes" onclick={toggle}>
    {#each layout.pips as pip (pip.ship.shipId)}
        <Pip ship={pip.ship} x={pip.x} y={pip.y} r={layout.r} />
    {/each}
</g>

<style>
    .lanes {
        cursor: pointer;
    }
</style>
