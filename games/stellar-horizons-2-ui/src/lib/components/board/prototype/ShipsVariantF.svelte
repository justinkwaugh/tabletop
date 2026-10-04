<script lang="ts">
    // PROTOTYPE variant F: each faction as a honeycomb "moon" clump placed in open space.
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

    let { frame, groups }: { frame: SystemFrame; groups: FactionGroup[] } = $props()
    function arrange(r: number) {
        const blocked: Obstacle[] = obstacles(frame)
        const candidates: Point[] = []
        for (let y = -frame.height * 0.45; y < frame.height * 0.45; y += 8) {
            for (let x = -frame.width * 0.45; x < frame.width * 0.45; x += 8)
                candidates.push({ x, y })
        }
        candidates.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))
        const ordered = [...groups].sort((a, b) => b.ships.length - a.ships.length)
        return ordered.flatMap((group) => {
            const cells = honeycomb(group.ships.length, r * 2.2)
            const fits = (center: Point) =>
                cells.every((cell) =>
                    isFree({ x: center.x + cell.x, y: center.y + cell.y }, blocked, frame, r, 1)
                )
            const center = candidates.find(fits)
            if (!center) return []
            const extent = Math.max(...cells.map((cell) => Math.hypot(cell.x, cell.y))) + r
            blocked.push({ x: center.x, y: center.y, r: extent + 3 })
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
        <circle
            cx={clump.center.x}
            cy={clump.center.y}
            r={clump.extent + 3}
            fill="rgba(0,0,0,0.35)"
            stroke={FACTION_FILL[clump.group.faction]}
            stroke-width="1.5"
            stroke-opacity="0.7"
        ></circle>
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
