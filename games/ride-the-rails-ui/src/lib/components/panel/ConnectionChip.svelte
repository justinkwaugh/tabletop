<script lang="ts">
    import { cityById } from '@tabletop/ride-the-rails'
    import { CONNECTION_KEY } from '$lib/animators/flights.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { listed, turnLineBonusDescription } from '$lib/utils/bonusDescription.js'
    import { connectionBonus, connectionChip } from '$lib/utils/linkBonus.js'
    import ClaimMedallion from '../board/ClaimMedallion.svelte'
    import BonusDescription from './BonusDescription.svelte'
    import SeatDot from './SeatDot.svelte'

    const gameSession = getGameSession()
    const chipId = $props.id()
    const descriptionId = `${chipId}-description`

    const bonus = $derived(connectionBonus(gameSession.gameState.mapId))
    const chip = $derived(
        connectionChip(gameSession.gameState.mapId, gameSession.gameState.connectionClaim)
    )
    const cities = $derived(listed((bonus?.cityIds ?? []).map((cityId) => cityById(cityId).name)))
    const label = $derived(
        chip?.claim
            ? `${chip.name}: claimed by ${gameSession.getPlayerName(chip.claim.playerId)} for $${chip.amount}`
            : `${chip?.name}: unclaimed, $${chip?.amount} to the first network joining ${cities}`
    )
    const description = $derived(
        turnLineBonusDescription(gameSession.gameState, (playerId) =>
            gameSession.getPlayerName(playerId)
        )
    )
    const open = $derived(bonus !== undefined && gameSession.openBonusDescription === bonus.id)
</script>

<!-- R-8, Contract, The table: a map's connection bonus in the turn line, in the Transcontinental's
     place and look; where the claim's coin lands. Wider screens name it and its terms or claimant.
     A press opens its description: the rule, its cities, and whether it is open or claimed. -->
{#if chip && bonus}
    <button
        type="button"
        id={chipId}
        class="chip"
        aria-label={label}
        aria-expanded={open}
        aria-controls={descriptionId}
        aria-describedby={open ? `${descriptionId}-text` : undefined}
        onclick={() => gameSession.toggleBonusDescription(bonus.id)}
    >
        <span class="medallion" data-flight-target={CONNECTION_KEY}>
            <ClaimMedallion size={22} amount={chip.claim ? chip.amount : undefined} />
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
    </button>
    {#if open && description}
        <BonusDescription
            {description}
            id={descriptionId}
            {chipId}
            onClose={() => gameSession.closeBonusDescription()}
        />
    {/if}
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
        cursor: pointer;
        outline-offset: 2px;
    }

    .chip:focus-visible {
        outline: 2px solid var(--rtr-accent);
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
