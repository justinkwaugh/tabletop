<script lang="ts">
    import {
        PHONE_ROUND_KEY,
        ROUND_KEY,
        phoneEntryKey,
        supplyKey
    } from '$lib/animators/flights.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PHONE_LATER_OPACITY } from '$lib/utils/marginLayout.js'
    import {
        railroadStrip,
        romanRound,
        shownRoundNumber,
        supplyText,
        type RailroadStripEntry
    } from '$lib/utils/marginTracks.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import LocomotiveIcon from './board/LocomotiveIcon.svelte'
    import RailroadSpotlightControl from './RailroadSpotlightControl.svelte'
    import PhoneTranscontinental from './PhoneTranscontinental.svelte'

    const gameSession = getGameSession()
    const flights = gameSession.flights

    // Supply ticks ahead of the shown state as a flight lifts (Animation plan, Share).
    const entries = $derived(
        railroadStrip(gameSession.gameState).map((entry) => ({
            ...entry,
            supply: gameSession.flights.shown(supplyKey(entry.railroadId), entry.supply)
        }))
    )
    // The badge steps to the next round as the end of round plays (Animation plan, End of round).
    const round = $derived(flights.shown(ROUND_KEY, shownRoundNumber(gameSession.gameState)))

    function entryText(entry: RailroadStripEntry): string {
        if (!entry.available) return `R${romanRound(entry.availableFromRound)}`
        return entry.supply > 0 ? `${entry.supply} left` : 'none'
    }

    function entryLabel(entry: RailroadStripEntry): string {
        const name = railroadStyle(entry.railroadId).name
        if (!entry.available) return `${name}: available from round ${entry.availableFromRound}`
        return `${name}: ${supplyText(entry.supply)}, ${entry.trackCount} track`
    }
</script>

<!-- Contract, Phone layout: the round badge and the six railroad entries in one row above the
     board, outside the scaling, then the Transcontinental once claimed; the spotlight control on
     phones. The end of round steps the badge and brightens the entry made available. -->
<div class="phone-strip flex sm:hidden">
    <div
        class="round rtr-display"
        aria-label="Round {round}"
        use:flights.register={PHONE_ROUND_KEY}
    >
        {romanRound(round)}<small>round</small>
    </div>
    {#each entries as entry (entry.railroadId)}
        <div
            class="slot"
            style:opacity={entry.available ? undefined : PHONE_LATER_OPACITY}
            use:flights.register={phoneEntryKey(entry.railroadId)}
        >
            <RailroadSpotlightControl
                railroadId={entry.railroadId}
                label={entryLabel(entry)}
                class="entry {entry.available && entry.supply === 0 ? 'empty' : ''}"
            >
                <span class="icon" data-flight-target={supplyKey(entry.railroadId)}>
                    <LocomotiveIcon railroadId={entry.railroadId} width={22} />
                </span>
                <span>{entryText(entry)}</span>
            </RailroadSpotlightControl>
        </div>
    {/each}
    <PhoneTranscontinental />
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

    .slot {
        flex: 1;
        min-width: 0;
        display: flex;
    }

    .icon {
        display: flex;
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

    .phone-strip :global(.entry.empty) {
        color: var(--rtr-cost);
    }
</style>
