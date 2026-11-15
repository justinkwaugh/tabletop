<script lang="ts">
    import { ROUND_COUNT } from '@tabletop/ride-the-rails'
    import { ROUND_KEY, roundTicketKey } from '$lib/animators/flights.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { romanRound, shownRoundNumber } from '$lib/utils/marginTracks.js'

    const gameSession = getGameSession()
    const flights = gameSession.flights

    // The current ticket steps as the end of round plays (Animation plan, End of round).
    const round = $derived(flights.shown(ROUND_KEY, shownRoundNumber(gameSession.gameState)))
    const rounds = Array.from({ length: ROUND_COUNT }, (_, index) => index + 1)
</script>

<!-- R-2.1, Contract, Desktop layout: rounds I to VI in the turn line, the current one dark. -->
<span class="tickets inline-flex max-lg:hidden" role="list" aria-label="Rounds">
    {#each rounds as ticket (ticket)}
        <span
            class="ticket rtr-serif"
            class:done={ticket < round}
            class:current={ticket === round}
            role="listitem"
            aria-label="Round {ticket}"
            aria-current={ticket === round ? 'step' : undefined}
            use:flights.register={roundTicketKey(ticket)}>{romanRound(ticket)}</span
        >
    {/each}
</span>

<style>
    .tickets {
        flex: none;
        gap: 4px;
    }

    .ticket {
        display: inline-grid;
        place-items: center;
        width: 30px;
        height: 26px;
        border: 1px solid var(--rtr-line);
        border-radius: 5px;
        background: var(--rtr-panel-raised);
        color: var(--rtr-ink-muted);
        font-size: 11px;
    }

    .ticket.done {
        color: var(--rtr-ink);
    }

    .ticket.current {
        border-color: var(--rtr-ink);
        background: var(--rtr-ink);
        color: var(--rtr-ink-light);
    }
</style>
