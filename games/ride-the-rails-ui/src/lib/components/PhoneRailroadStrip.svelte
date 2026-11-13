<script lang="ts">
    import { currentRoundNumber } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { railroadStrip, romanRound, type RailroadStripEntry } from '$lib/utils/marginTracks.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import LocomotiveIcon from './board/LocomotiveIcon.svelte'
    import RailroadSpotlightControl from './RailroadSpotlightControl.svelte'

    const gameSession = getGameSession()

    const entries = $derived(railroadStrip(gameSession.gameState))
    const round = $derived(currentRoundNumber(gameSession.gameState))

    function entryText(entry: RailroadStripEntry): string {
        if (!entry.available) return `R${romanRound(entry.availableFromRound)}`
        return entry.supply > 0 ? `${entry.supply} left` : 'none'
    }

    function entryLabel(entry: RailroadStripEntry): string {
        const name = railroadStyle(entry.railroadId).name
        if (!entry.available) return `${name}: available from round ${entry.availableFromRound}`
        return `${name}: ${entry.supply > 0 ? `${entry.supply} left` : 'none left'}, ${entry.trackCount} track`
    }
</script>

<!-- Contract, Phone layout: the round badge and the six railroad entries in one row above the
     board, outside the scaling; the spotlight control on phones. -->
<div class="phone-strip flex sm:hidden">
    <div class="round rtr-display" aria-label="Round {round}">
        {romanRound(round)}<small>round</small>
    </div>
    {#each entries as entry (entry.railroadId)}
        <RailroadSpotlightControl
            railroadId={entry.railroadId}
            label={entryLabel(entry)}
            class="entry {entry.available ? '' : 'later'} {entry.available && entry.supply === 0
                ? 'empty'
                : ''}"
        >
            <LocomotiveIcon railroadId={entry.railroadId} width={22} />
            <span>{entryText(entry)}</span>
        </RailroadSpotlightControl>
    {/each}
</div>

<style>
    .phone-strip {
        gap: 4px;
        padding: 0 8px 6px;
        align-items: stretch;
    }

    .round {
        flex: none;
        width: 34px;
        border-radius: 7px;
        background: var(--rtr-ink);
        color: var(--rtr-panel);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        line-height: 1;
    }

    .round small {
        font-family: initial;
        font-weight: 400;
        font-size: 9px;
        opacity: 0.8;
    }

    .phone-strip :global(.entry) {
        flex: 1;
        min-width: 0;
        border-radius: 7px;
        background: var(--rtr-panel);
        border: 1px solid var(--rtr-line);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3px 0 2px;
        font-size: 10.5px;
        line-height: 1.1;
        color: var(--rtr-ink-muted);
    }

    .phone-strip :global(.entry.later) {
        opacity: 0.45;
    }

    .phone-strip :global(.entry.empty) {
        color: var(--rtr-cost);
    }
</style>
