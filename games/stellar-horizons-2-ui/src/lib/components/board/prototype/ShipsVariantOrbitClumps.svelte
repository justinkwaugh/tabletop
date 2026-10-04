<script lang="ts">
    // PROTOTYPE variants H/I: faction clumps threaded clockwise along an orbit among the worlds,
    // taking the next open stretch; a clump that won't fit steps slightly in or out.
    import type { Point } from '@tabletop/common'
    import type { SystemFrame } from '$lib/utils/boardLayout.js'
    import { FACTION_FILL } from '$lib/utils/presentation.js'
    import { shipPrototype, type FactionGroup } from './prototypeState.svelte.js'
    import {
        LARGEST_PIP,
        fitPips,
        honeycomb,
        isFree,
        obstacles,
        type Obstacle
    } from './pipLayout.js'
    import Pip from './Pip.svelte'

    let {
        frame,
        groups,
        backing
    }: { frame: SystemFrame; groups: FactionGroup[]; backing: 'ring' | 'disc' | 'none' } = $props()

    const orbit = $derived(
        frame.slots.length > 0
            ? frame.slots.reduce((sum, slot) => sum + Math.hypot(slot.x, slot.y), 0) /
                  frame.slots.length
            : frame.height * 0.28
    )

    function arrange(r: number) {
        const blocked: Obstacle[] = obstacles(frame)
        const offsets = [0, -10, 10, -20, 20, -32, 32, -46, 46, -62, 62]
        let cursor = -Math.PI / 2
        return groups.flatMap((group) => {
            const cells = honeycomb(group.ships.length, r * 2.2)
            const extent = Math.max(...cells.map((cell) => Math.hypot(cell.x, cell.y))) + r
            const fits = (center: Point) =>
                cells.every((cell) =>
                    isFree({ x: center.x + cell.x, y: center.y + cell.y }, blocked, frame, r, 1)
                )
            for (let step = 0; step < 90; step++) {
                const angle = cursor + (step * Math.PI * 2) / 90
                for (const offset of offsets) {
                    const radius = orbit + offset
                    const center = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
                    if (!fits(center)) continue
                    blocked.push({ ...center, r: extent + 3 })
                    cursor = angle + (extent * 2) / Math.max(radius, 1)
                    return [
                        {
                            group,
                            center,
                            extent,
                            pips: group.ships.map((ship, index) => ({
                                ship,
                                x: center.x + cells[index].x,
                                y: center.y + cells[index].y
                            }))
                        }
                    ]
                }
            }
            return []
        })
    }

    const layout = $derived.by(() => {
        const total = groups.reduce((sum, group) => sum + group.ships.length, 0)
        let clumps = arrange(LARGEST_PIP)
        const fitted = fitPips(total, (r) => {
            clumps = arrange(r)
            return clumps.flatMap((clump) => clump.pips)
        })
        return { r: fitted.r, clumps }
    })

    function toggle() {
        shipPrototype.drawerSystemId =
            shipPrototype.drawerSystemId === frame.systemId ? undefined : frame.systemId
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<g class="clumps" onclick={toggle}>
    {#each layout.clumps as clump (clump.group.faction)}
        {#if backing !== 'none'}
            <circle
                cx={clump.center.x}
                cy={clump.center.y}
                r={clump.extent + (backing === 'disc' ? 6 : 3)}
                fill={backing === 'disc' ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.35)'}
                stroke={backing === 'ring' ? FACTION_FILL[clump.group.faction] : 'none'}
                stroke-width="1.5"
                stroke-opacity="0.7"
                filter={backing === 'disc' ? 'url(#sh-disc-soften)' : undefined}
            ></circle>
        {/if}
        {#each clump.pips as pip (pip.ship.shipId)}
            <Pip ship={pip.ship} x={pip.x} y={pip.y} r={layout.r} />
        {/each}
    {/each}
</g>

<style>
    .clumps {
        cursor: pointer;
    }
</style>
