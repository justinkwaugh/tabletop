<script lang="ts">
    import { TRANSCONTINENTAL_BONUS } from '@tabletop/ride-the-rails'
    import { TRANSCONTINENTAL_KEY } from '$lib/animators/flights.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import TranscontinentalClaim from '../board/TranscontinentalClaim.svelte'
    import SeatDot from './SeatDot.svelte'

    const gameSession = getGameSession()
    const descriptionId = $props.id()

    const claim = $derived(gameSession.gameState.transcontinental)
    const toggle = $derived(gameSession.transcontinentalLineToggle)
    const city = TRANSCONTINENTAL_BONUS.cityHexAmount
    const other = TRANSCONTINENTAL_BONUS.otherHexAmount

    const claimLabel = $derived(
        claim
            ? `Transcontinental: claimed by ${gameSession.getPlayerName(claim.playerId)} for $${claim.amount}`
            : `Transcontinental: unclaimed, $${city} when every switch is in a city, $${other} otherwise`
    )
    const toggleLabel = $derived(`${toggle?.shown ? 'Hide' : 'Show'} the Transcontinental line`)
</script>

<!-- R-4.3.3, Contract, The table: the Transcontinental in the turn line, its medallion drawn as it
     always was; where the claim's coin lands. Wider screens name it and its terms or claimant.
     Once claimed it is the viewer's button for the claimed line, outlined in gold while shown. -->
{#snippet content()}
    <span class="medallion" data-flight-target={TRANSCONTINENTAL_KEY}>
        <TranscontinentalClaim size={22} />
    </span>
    <span class="name rtr-serif max-lg:hidden">Transcontinental</span>
    {#if claim}
        <SeatDot playerId={claim.playerId} />
        <span class="terms max-lg:hidden">{gameSession.getPlayerName(claim.playerId)}</span>
    {:else}
        <span class="terms max-lg:hidden">${city} / ${other} · open</span>
        <span class="terms lg:hidden">${city}/${other}</span>
    {/if}
{/snippet}

{#if toggle}
    <button
        type="button"
        class="chip toggle"
        class:shown={toggle.shown}
        aria-label={toggleLabel}
        aria-pressed={toggle.shown}
        aria-describedby={descriptionId}
        onclick={() => gameSession.toggleTranscontinentalLine()}
    >
        {@render content()}
        <span id={descriptionId} class="sr-only">{claimLabel}</span>
    </button>
{:else}
    <span class="chip" role="img" aria-label={claimLabel}>
        {@render content()}
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

    .toggle {
        cursor: pointer;
        outline-offset: 2px;
    }

    .toggle:focus-visible {
        outline: 2px solid var(--rtr-accent);
    }

    .shown {
        border-color: var(--rtr-gold);
        box-shadow: 0 0 0 1px var(--rtr-gold);
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
