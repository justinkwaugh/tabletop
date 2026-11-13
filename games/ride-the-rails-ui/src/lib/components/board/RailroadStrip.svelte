<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { spotlightHandlers } from '$lib/model/railroadSpotlight.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MARGIN_BOXES, drawsSeatInitials } from '$lib/utils/boardGeometry.js'
    import { railroadStrip, type RailroadStripEntry } from '$lib/utils/marginTracks.js'
    import {
        STRIP_COLUMN as COLUMN,
        STRIP_LOCOMOTIVE,
        STRIP_ROW as ROW
    } from '$lib/utils/marginLayout.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'
    import { sharesKey, supplyKey } from '$lib/animators/flights.svelte.js'
    import Locomotive from './Locomotive.svelte'
    import MarginPanel from './MarginPanel.svelte'
    import SeatMarker from './SeatMarker.svelte'

    let { viewScale, initials }: { viewScale: number; initials: ReadonlyMap<string, string> } =
        $props()

    const gameSession = getGameSession()

    const box = MARGIN_BOXES.railroadStrip
    const HOLDER_RADIUS = 12

    // Counts tick ahead of the shown state as a flight lifts or lands (Animation plan, Share).
    const entries = $derived(
        railroadStrip(gameSession.gameState).map((entry) => ({
            ...entry,
            supply: gameSession.flights.shown(supplyKey(entry.railroadId), entry.supply),
            shareholders: entry.shareholders.map((holding) => ({
                ...holding,
                shares: gameSession.flights.shown(
                    sharesKey(holding.playerId, entry.railroadId),
                    holding.shares
                )
            }))
        }))
    )
    const showsInitials = $derived(drawsSeatInitials(viewScale))

    function supplyText(entry: RailroadStripEntry): string {
        return entry.supply > 0 ? `${entry.supply} left` : 'none left'
    }

    function entryLabel(entry: RailroadStripEntry): string {
        const name = railroadStyle(entry.railroadId).name
        if (!entry.available) return `${name}: available from round ${entry.availableFromRound}`
        const holders = entry.shareholders
            .map((holding) => `${gameSession.getPlayerName(holding.playerId)} ${holding.shares}`)
            .join(', ')
        return `${name}: ${supplyText(entry)}, ${entry.trackCount} track${holders ? `, shares ${holders}` : ''}`
    }

    function handlersFor(railroadId: RailroadId) {
        return spotlightHandlers(gameSession, railroadId)
    }
</script>

<!-- Contract, The table: one entry per railroad, its supply left, its track and its shareholders;
     dim until its round (R-1.4). A press or hover spotlights it. -->
<MarginPanel {box} caption="Railroads">
    <text x={COLUMN.supply} y="27" text-anchor="end" class="head" fill="var(--rtr-ink-muted)"
        >supply</text
    >
    <text x={COLUMN.track} y="27" text-anchor="end" class="head" fill="var(--rtr-ink-muted)"
        >track</text
    >
    {#each entries as entry, index (entry.railroadId)}
        {@const top = ROW.top + index * ROW.height}
        {@const middle = top + ROW.height / 2}
        {@const spotlit = gameSession.spotlightRailroadId === entry.railroadId}
        {@const handlers = handlersFor(entry.railroadId)}
        <g
            class="entry"
            role="button"
            tabindex="0"
            aria-label={entryLabel(entry)}
            aria-pressed={spotlit}
            onclick={handlers.onclick}
            onkeydown={handlers.onkeydown}
            onpointerenter={handlers.onpointerenter}
            onpointerleave={handlers.onpointerleave}
        >
            <rect
                class="plate"
                x="8"
                y={top + 3}
                width={box.width - 16}
                height={ROW.height - 6}
                rx="10"
                fill={spotlit ? 'var(--rtr-accent-fill)' : 'transparent'}
                stroke={spotlit ? 'var(--rtr-accent)' : 'transparent'}
                stroke-width="3"
            ></rect>
            <Locomotive
                railroadId={entry.railroadId}
                x={STRIP_LOCOMOTIVE.x}
                y={middle}
                width={STRIP_LOCOMOTIVE.width}
            />
            <text x={COLUMN.name} y={middle - 4} class="name" fill="var(--rtr-ink)"
                >{railroadStyle(entry.railroadId).name}</text
            >
            {#if entry.available}
                <text
                    x={COLUMN.supply}
                    y={middle - 4}
                    text-anchor="end"
                    class="figure"
                    fill={entry.supply > 0 ? 'var(--rtr-ink)' : 'var(--rtr-cost)'}
                    >{supplyText(entry)}</text
                >
                <text
                    x={COLUMN.track}
                    y={middle - 4}
                    text-anchor="end"
                    class="figure"
                    fill="var(--rtr-ink)">{entry.trackCount}</text
                >
                {#each entry.shareholders as holding, holderIndex (holding.playerId)}
                    {@const x = COLUMN.holders + holderIndex * COLUMN.holderStep}
                    <SeatMarker
                        playerId={holding.playerId}
                        initials={showsInitials ? initials.get(holding.playerId) : undefined}
                        {x}
                        y={middle + 15}
                        radius={HOLDER_RADIUS}
                    />
                    <text
                        x={x + HOLDER_RADIUS + 4}
                        y={middle + 21}
                        class="shares"
                        fill="var(--rtr-ink)">{holding.shares}</text
                    >
                {/each}
            {:else}
                <text
                    x={COLUMN.track}
                    y={middle - 4}
                    text-anchor="end"
                    class="later"
                    fill="var(--rtr-ink-muted)">from round {entry.availableFromRound}</text
                >
                <!-- A plain translucent veil over the one entry, never a group opacity. -->
                <rect
                    x="8"
                    y={top + 3}
                    width={box.width - 16}
                    height={ROW.height - 6}
                    rx="10"
                    fill="var(--rtr-panel)"
                    fill-opacity="0.55"
                ></rect>
            {/if}
        </g>
    {/each}
</MarginPanel>

<style>
    .entry {
        cursor: pointer;
    }

    .entry:focus {
        outline: none;
    }

    .entry:focus-visible .plate {
        stroke: var(--rtr-ink);
    }

    .head {
        font-size: 13px;
    }

    .name {
        font-size: 19px;
        font-weight: 700;
    }

    .figure {
        font-size: 18px;
        font-weight: 700;
    }

    .later {
        font-size: 16px;
    }

    .shares {
        font-size: 15px;
        font-weight: 800;
    }
</style>
