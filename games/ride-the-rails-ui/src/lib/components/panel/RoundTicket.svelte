<script lang="ts">
    import type { RoundTicket } from '$lib/utils/marginTracks.js'

    let { ticket }: { ticket: RoundTicket } = $props()
</script>

<!-- One round's ticket as the turn line draws it: filled with the colour of the railroads the round
     makes available, or light with none. -->
<span
    class="ticket rtr-serif"
    class:painted={ticket.paint !== undefined}
    class:halo={ticket.paint?.halo}
    style:background={ticket.paint?.background}
    style:color={ticket.paint?.ink}
    aria-label={ticket.label}>{ticket.numeral}</span
>

<style>
    .ticket {
        display: inline-grid;
        place-items: center;
        width: 32px;
        height: 28px;
        border: 1px solid var(--rtr-line);
        border-radius: 5px;
        background: var(--rtr-panel-raised);
        color: var(--rtr-ink);
        font-size: 13px;
        letter-spacing: 0;
    }

    .ticket.painted {
        border-color: var(--rtr-cube-edge);
    }

    .ticket.halo {
        text-shadow:
            0 0 2px var(--rtr-halo),
            0 0 1px var(--rtr-halo);
    }
</style>
