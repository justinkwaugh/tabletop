<script lang="ts">
    // PROTOTYPE: popovers and drawer drawn above every system tile.
    import { FACTION_ART } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { FACTION_FILL, systemName } from '$lib/utils/presentation.js'
    import type { BoardLayout } from '$lib/utils/boardLayout.js'
    import {
        factionGroups,
        shipPrototype,
        type DisplayShip,
        type FactionGroup
    } from './prototypeState.svelte.js'
    import ProtoCounter from './ProtoCounter.svelte'

    let { layout }: { layout: BoardLayout } = $props()
    const gameSession = getGameSession()
    const PAD = 12
    const GAP = 6

    interface Panel {
        systemId: string
        title: string
        rows: { faction: FactionGroup['faction']; ships: DisplayShip[] }[]
        counterWidth: number
        perRow: number
    }

    const panel: Panel | undefined = $derived.by(() => {
        const hover = shipPrototype.hover
        const drawer = shipPrototype.drawerSystemId
        const systemId = drawer ?? hover?.systemId
        if (!systemId) return undefined
        const groups = factionGroups(gameSession.gameState, systemId, shipPrototype.crowd)
        if (drawer) {
            return {
                systemId,
                title: `Ships at ${systemName(systemId)}`,
                rows: groups,
                counterWidth: 74,
                perRow: 8
            }
        }
        if (hover?.shipId) {
            const ship = groups
                .flatMap((group) => group.ships)
                .find((candidate) => candidate.shipId === hover.shipId)
            return ship
                ? {
                      systemId,
                      title: '',
                      rows: [{ faction: ship.faction, ships: [ship] }],
                      counterWidth: 170,
                      perRow: 1
                  }
                : undefined
        }
        const group = groups.find((candidate) => candidate.faction === hover?.faction)
        return group
            ? { systemId, title: '', rows: [group], counterWidth: 94, perRow: 5 }
            : undefined
    })

    const geometry = $derived.by(() => {
        if (!panel) return undefined
        const frame = layout.frames.find((candidate) => candidate.systemId === panel.systemId)
        if (!frame) return undefined
        const counterHeight = (panel.counterWidth * 172) / 208
        const emblem = panel.perRow > 1 ? 34 : 0
        const lines = panel.rows.map((row) => Math.ceil(row.ships.length / panel.perRow))
        const titleHeight = panel.title ? 34 : 0
        const width =
            PAD * 2 +
            emblem +
            (emblem ? GAP : 0) +
            Math.min(panel.perRow, Math.max(...panel.rows.map((row) => row.ships.length))) *
                (panel.counterWidth + GAP) -
            GAP
        const height =
            PAD * 2 +
            titleHeight +
            lines.reduce((sum, count) => sum + count * (counterHeight + GAP), 0) -
            GAP
        let x = frame.center.x - width / 2
        x = Math.max(8, Math.min(layout.width - width - 8, x))
        let y = frame.center.y - frame.height / 2 - height - 8
        if (y < 8) y = Math.min(layout.height - height - 8, frame.center.y + frame.height / 2 + 8)
        let cursor = PAD + titleHeight
        const placed = panel.rows.map((row, index) => {
            const top = cursor
            cursor += lines[index] * (counterHeight + GAP)
            return {
                row,
                top,
                ships: row.ships.map((ship, shipIndex) => ({
                    ship,
                    x:
                        PAD +
                        emblem +
                        (emblem ? GAP : 0) +
                        (shipIndex % panel.perRow) * (panel.counterWidth + GAP),
                    y: top + Math.floor(shipIndex / panel.perRow) * (counterHeight + GAP)
                }))
            }
        })
        return { x, y, width, height, placed, emblem }
    })
</script>

{#if panel && geometry}
    <g transform="translate({geometry.x} {geometry.y})" pointer-events="none">
        <rect
            width={geometry.width}
            height={geometry.height}
            rx="12"
            fill="rgba(6,10,20,0.95)"
            stroke="#7fd3ff"
            stroke-width="2"
        ></rect>
        {#if panel.title}
            <text x={PAD} y={PAD + 20} font-size="22" font-weight="700" fill="#e8f4ff"
                >{panel.title}</text
            >
        {/if}
        {#each geometry.placed as line (line.row.faction)}
            {#if geometry.emblem}
                <image
                    href={FACTION_ART[line.row.faction]}
                    x={PAD}
                    y={line.top}
                    width={geometry.emblem}
                    height={geometry.emblem}
                ></image>
                <rect
                    x={PAD}
                    y={line.top + geometry.emblem + 2}
                    width={geometry.emblem}
                    height="4"
                    fill={FACTION_FILL[line.row.faction]}
                ></rect>
            {/if}
            {#each line.ships as entry (entry.ship.shipId)}
                <ProtoCounter
                    ship={entry.ship}
                    x={entry.x}
                    y={entry.y}
                    width={panel.counterWidth}
                />
            {/each}
        {/each}
    </g>
{/if}
