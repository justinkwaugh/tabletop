<script lang="ts">
    import type { Plant } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { WORKS } from '$lib/utils/boardLayout.js'

    // One player's werk for a locomotive: their colour, their units, and the units already shipped
    // this production phase, which sit above the card until it ends. A dashed ring marks a
    // shipment being held back. On the acting player's turn their werks are highlighted as
    // targets, showing the units they plan to have and a note on what choosing the werk does.
    let {
        x,
        y,
        playerId,
        plant,
        held = false,
        units,
        note,
        closing = false,
        target
    }: {
        x: number
        y: number
        playerId: string
        plant: Plant
        held?: boolean
        units?: number
        note?: string
        closing?: boolean
        target?: { selected: boolean }
    } = $props()

    const gameSession = getGameSession()

    const color = $derived(gameSession.colors.getPlayerUiColor(playerId))
    const ink = $derived(gameSession.colors.getPlayerTextColorValue(playerId))
    const name = $derived(gameSession.getPlayerName(playerId))
    const shown = $derived(units ?? plant.units - plant.shipped)
    const line = $derived(note ?? (plant.shipped > 0 ? `${plant.shipped} shipped` : undefined))
    const RIM = 4
    const label = $derived(
        `${name}: ${plant.units} units${plant.shipped > 0 ? `, ${plant.shipped} shipped` : ''}`
    )
</script>

<g
    id="lw-works-{playerId}-{plant.locomotiveId}"
    transform="translate({x} {y})"
    role="img"
    aria-label={label}
>
    {#if target}
        <rect
            x={-RIM}
            y={-RIM}
            width={WORKS.width + 2 * RIM}
            height={WORKS.height + 2 * RIM}
            rx="9"
            fill={target.selected ? '#f2c14e' : 'none'}
            fill-opacity="0.35"
            stroke="#d39a12"
            stroke-width={target.selected ? 3.5 : 2.5}
            stroke-dasharray={held ? '5 4' : undefined}
        ></rect>
    {:else if held}
        <rect
            x={-RIM}
            y={-RIM}
            width={WORKS.width + 2 * RIM}
            height={WORKS.height + 2 * RIM}
            rx="9"
            fill="none"
            stroke="#627688"
            stroke-width="2.5"
            stroke-dasharray="5 4"
        ></rect>
    {/if}
    <g opacity={closing ? 0.45 : 1}>
        <rect
            x="1.5"
            y="2.5"
            width={WORKS.width}
            height={WORKS.height}
            rx="6"
            fill="#2a333b"
            fill-opacity="0.3"
        ></rect>
        <rect width={WORKS.width} height={WORKS.height} rx="6" fill={color}></rect>
        <rect
            x="3"
            y="3"
            width={WORKS.width - 6}
            height={WORKS.height - 6}
            rx="4"
            fill="none"
            stroke={ink}
            stroke-opacity="0.45"
            stroke-width="1"
        ></rect>
        <text
            class="units"
            x={WORKS.width / 2}
            y={line ? 31 : 37}
            text-anchor="middle"
            fill={ink}
            fill-opacity={held ? 0.55 : 1}>{shown}</text
        >
        {#if line}
            <text class="note" x={WORKS.width / 2} y="46" text-anchor="middle" fill={ink}
                >{line}</text
            >
        {/if}
    </g>
</g>

<style>
    .units {
        font-family: 'LW Baskerville', Georgia, serif;
        font-size: 24px;
        font-weight: 700;
    }

    .note {
        font-family: 'LW Baskerville', Georgia, serif;
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.02em;
    }
</style>
