<script lang="ts">
    import { ROUND_KEY, roundTicketKey } from '$lib/animators/flights.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { roundTickets, shownRoundNumber } from '$lib/utils/marginTracks.js'

    const gameSession = getGameSession()
    const flights = gameSession.flights

    // The current ticket steps as the end of round plays (Animation plan, End of round).
    const round = $derived(flights.shown(ROUND_KEY, shownRoundNumber(gameSession.gameState)))
    const tickets = $derived(roundTickets(gameSession.gameState.mapId))
</script>

<!-- R-2.1, R-1.4, Contract, Desktop layout: rounds I to VI in the turn line, each filled with the
     colour of the railroads its round makes available (round I split Red and Blue); a round with
     none keeps the light ticket. The current one is ringed and underlined in ink. -->
<span class="tickets inline-flex max-lg:hidden" role="list" aria-label="Rounds">
    {#each tickets as ticket (ticket.round)}
        <span
            class="ticket rtr-serif"
            class:painted={ticket.paint !== undefined}
            class:halo={ticket.paint?.halo}
            class:done={ticket.round < round}
            class:current={ticket.round === round}
            style:background={ticket.paint?.background}
            style:color={ticket.paint?.ink}
            role="listitem"
            aria-label={ticket.label}
            aria-current={ticket.round === round ? 'step' : undefined}
            use:flights.register={roundTicketKey(ticket.round)}>{ticket.numeral}</span
        >
    {/each}
</span>

<style>
    /* 6 px apart, so the current ticket's ring stands clear of its neighbours. */
    .tickets {
        flex: none;
        gap: 6px;
    }

    .ticket {
        position: relative;
        display: inline-grid;
        place-items: center;
        width: 28px;
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

    /* A railroad's colour takes the cube's dark edge. */
    .ticket.painted {
        border-color: var(--rtr-cube-edge);
    }

    .ticket.halo {
        text-shadow:
            0 0 2px var(--rtr-halo),
            0 0 1px var(--rtr-halo);
    }

    /* Clear of the fill by a hair of the header, so the ring reads on any colour, Black's too. */
    .ticket.current {
        outline: 2px solid var(--rtr-ink);
        outline-offset: 1px;
    }

    .ticket.current::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: -8px;
        width: 14px;
        height: 2px;
        margin-left: -7px;
        border-radius: 1px;
        background: var(--rtr-ink);
    }
</style>
