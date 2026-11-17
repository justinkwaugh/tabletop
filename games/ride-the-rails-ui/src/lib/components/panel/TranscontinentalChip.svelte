<script lang="ts">
    import { TRANSCONTINENTAL_BONUS } from '@tabletop/ride-the-rails'
    import { TRANSCONTINENTAL_KEY } from '$lib/animators/flights.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { turnLineBonusDescription } from '$lib/utils/bonusDescription.js'
    import TranscontinentalClaim from '../board/TranscontinentalClaim.svelte'
    import BonusDescription from './BonusDescription.svelte'
    import SeatDot from './SeatDot.svelte'

    const gameSession = getGameSession()
    const chipId = $props.id()
    const descriptionId = `${chipId}-description`

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
    const description = $derived(
        turnLineBonusDescription(gameSession.gameState, (playerId) =>
            gameSession.getPlayerName(playerId)
        )
    )
    const open = $derived(gameSession.openBonusDescription === TRANSCONTINENTAL_BONUS.id)
</script>

<!-- R-4.3.3, Contract, The table: the Transcontinental in the turn line, its medallion drawn as it
     always was; where the claim's coin lands. Wider screens name it and its terms or claimant.
     A press opens its description: the rule, the coasts' cities, and whether it is open or
     claimed. Once claimed the description holds the viewer's button for the claimed line, and the
     chip is outlined in gold while the line is shown. -->
<button
    type="button"
    id={chipId}
    class="chip"
    class:shown={toggle?.shown}
    aria-label={claimLabel}
    aria-expanded={open}
    aria-controls={descriptionId}
    aria-describedby={open ? `${descriptionId}-text` : undefined}
    onclick={() => gameSession.toggleBonusDescription(TRANSCONTINENTAL_BONUS.id)}
>
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
</button>
{#if open && description}
    <BonusDescription
        {description}
        id={descriptionId}
        {chipId}
        onClose={() => gameSession.closeBonusDescription()}
    >
        {#if toggle}
            <button
                type="button"
                class="line-toggle"
                class:shown={toggle.shown}
                aria-pressed={toggle.shown}
                onclick={() => gameSession.toggleTranscontinentalLine()}>{toggleLabel}</button
            >
        {/if}
    </BonusDescription>
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

    .chip:focus-visible,
    .line-toggle:focus-visible {
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

    .line-toggle {
        align-self: flex-start;
        min-height: 32px;
        padding: 0 12px;
        border: 1px solid var(--rtr-line);
        border-radius: 8px;
        background: var(--rtr-panel-raised);
        color: var(--rtr-ink);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        outline-offset: 2px;
    }
</style>
