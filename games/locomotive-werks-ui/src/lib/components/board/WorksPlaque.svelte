<script lang="ts">
    import type { Plant } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { WORKS } from '$lib/utils/boardLayout.js'

    // One player's werk for a locomotive: their colour, their units, and the units already shipped
    // this production phase, which sit above the card until it ends. A dashed ring marks a
    // shipment being held back.
    let {
        x,
        y,
        playerId,
        plant,
        held = false
    }: {
        x: number
        y: number
        playerId: string
        plant: Plant
        held?: boolean
    } = $props()

    const gameSession = getGameSession()

    const color = $derived(gameSession.colors.getPlayerUiColor(playerId))
    const ink = $derived(gameSession.colors.getPlayerTextColorValue(playerId))
    const name = $derived(gameSession.getPlayerName(playerId))
    const waiting = $derived(plant.units - plant.shipped)
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
    {#if held}
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
        y={plant.shipped > 0 ? 31 : 37}
        text-anchor="middle"
        fill={ink}
        fill-opacity={held ? 0.55 : 1}>{waiting}</text
    >
    {#if plant.shipped > 0}
        <text class="shipped" x={WORKS.width / 2} y="46" text-anchor="middle" fill={ink}
            >{plant.shipped} shipped</text
        >
    {/if}
</g>

<style>
    .units {
        font-family: 'LW Baskerville', Georgia, serif;
        font-size: 24px;
        font-weight: 700;
    }

    .shipped {
        font-family: 'LW Baskerville', Georgia, serif;
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.02em;
    }
</style>
