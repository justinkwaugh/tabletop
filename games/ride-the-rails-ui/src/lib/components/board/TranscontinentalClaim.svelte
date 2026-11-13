<script lang="ts">
    import { TRANSCONTINENTAL_BONUS } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MARGIN_BOXES } from '$lib/utils/boardGeometry.js'
    import MarginPanel from './MarginPanel.svelte'
    import SeatMarker from './SeatMarker.svelte'

    let { initials }: { initials: ReadonlyMap<string, string> } = $props()

    const gameSession = getGameSession()

    const box = MARGIN_BOXES.transcontinental
    const MEDALLION = { x: box.width / 2, y: 84, radius: 36 }

    const claim = $derived(gameSession.gameState.transcontinental)
</script>

<!-- R-4.3.3, R-4.3.3-H1: the claim's medallion, or what the line would pay while unclaimed. -->
<MarginPanel {box} caption="Transcontinental">
    {#if claim}
        {@const name = gameSession.getPlayerName(claim.playerId)}
        <g role="img" aria-label="Claimed by {name} for ${claim.amount}">
            <circle
                cx={MEDALLION.x}
                cy={MEDALLION.y}
                r={MEDALLION.radius}
                fill="var(--rtr-gold)"
                stroke="var(--rtr-halo)"
                stroke-width="3"
            ></circle>
            <circle
                cx={MEDALLION.x}
                cy={MEDALLION.y}
                r={MEDALLION.radius - 7}
                fill="none"
                stroke="var(--rtr-ink-light)"
                stroke-opacity="0.55"
                stroke-width="2"
            ></circle>
            <text
                x={MEDALLION.x}
                y={MEDALLION.y + 11}
                text-anchor="middle"
                class="rtr-display amount"
                fill="var(--rtr-ink-light)">${claim.amount}</text
            >
            <SeatMarker
                playerId={claim.playerId}
                initials={initials.get(claim.playerId)}
                x={40}
                y={164}
                radius={15}
            />
            <text x={64} y={170} class="claimant" fill="var(--rtr-ink)">{name}</text>
        </g>
    {:else}
        <g
            role="img"
            aria-label="Unclaimed: ${TRANSCONTINENTAL_BONUS.cityHexAmount} when every switch is in a city, ${TRANSCONTINENTAL_BONUS.otherHexAmount} otherwise"
        >
            <circle
                cx={MEDALLION.x}
                cy={MEDALLION.y}
                r={MEDALLION.radius}
                fill="none"
                stroke="var(--rtr-gold)"
                stroke-width="3"
                stroke-dasharray="7 5"
            ></circle>
            <text x={MEDALLION.x} y={150} text-anchor="middle" class="terms" fill="var(--rtr-ink)"
                ><tspan font-weight="800">${TRANSCONTINENTAL_BONUS.cityHexAmount}</tspan> every switch
                in a city</text
            >
            <text x={MEDALLION.x} y={172} text-anchor="middle" class="terms" fill="var(--rtr-ink)"
                ><tspan font-weight="800">${TRANSCONTINENTAL_BONUS.otherHexAmount}</tspan> otherwise</text
            >
            <text
                x={MEDALLION.x}
                y={198}
                text-anchor="middle"
                class="note"
                fill="var(--rtr-ink-muted)">West to East Coast, 2+ railroads</text
            >
        </g>
    {/if}
</MarginPanel>

<style>
    .amount {
        font-size: 32px;
    }

    .claimant {
        font-size: 19px;
        font-weight: 700;
    }

    .terms {
        font-size: 15px;
    }

    .note {
        font-size: 13px;
    }
</style>
