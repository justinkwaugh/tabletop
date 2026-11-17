<script lang="ts">
    import { cityById } from '@tabletop/ride-the-rails'
    import { CONNECTION_KEY } from '$lib/animators/flights.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { connectionBonus, connectionChip } from '$lib/utils/linkBonus.js'
    import ClaimMedallion from '../board/ClaimMedallion.svelte'
    import SeatDot from './SeatDot.svelte'

    const gameSession = getGameSession()

    const chip = $derived(
        connectionChip(gameSession.gameState.mapId, gameSession.gameState.connectionClaim)
    )
    const cities = $derived(
        new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(
            (connectionBonus(gameSession.gameState.mapId)?.cityIds ?? []).map(
                (cityId) => cityById(cityId).name
            )
        )
    )
    const label = $derived(
        chip?.claim
            ? `${chip.name}: claimed by ${gameSession.getPlayerName(chip.claim.playerId)} for $${chip.amount}`
            : `${chip?.name}: unclaimed, $${chip?.amount} to the first network joining ${cities}`
    )
</script>

<!-- R-8, Contract, The table: a map's connection bonus in the turn line, in the Transcontinental's
     place and look; where the claim's coin lands. Wider screens name it and its terms or claimant. -->
{#if chip}
    <span class="chip" role="img" aria-label={label}>
        <span class="medallion" data-flight-target={CONNECTION_KEY}>
            <ClaimMedallion size={22} amount={chip.claim?.amount} />
        </span>
        <span class="name rtr-serif max-lg:hidden">{chip.name}</span>
        {#if chip.claim}
            <SeatDot playerId={chip.claim.playerId} />
            <span class="terms max-lg:hidden">{gameSession.getPlayerName(chip.claim.playerId)}</span
            >
        {:else}
            <span class="terms max-lg:hidden">${chip.amount} · open</span>
            <span class="terms lg:hidden">${chip.amount}</span>
        {/if}
    </span>
{/if}

<style>
    .chip {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 30px;
        padding: 0 8px 0 4px;
        border: 1px solid var(--rtr-line);
        border-radius: 8px;
        background: var(--rtr-panel-raised);
        color: var(--rtr-ink);
        white-space: nowrap;
    }

    .medallion {
        display: flex;
    }

    .name {
        font-size: 14px;
    }

    .terms {
        font-size: 12px;
        font-weight: 600;
        color: var(--rtr-ink-muted);
    }
</style>
