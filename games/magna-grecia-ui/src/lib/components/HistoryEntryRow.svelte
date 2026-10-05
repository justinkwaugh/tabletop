<script lang="ts">
    import { fade } from 'svelte/transition'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { HistoryLine } from '$lib/utils/historyTurns.js'
    import CityTileIcon from './icons/CityTileIcon.svelte'
    import MarketIcon from './icons/MarketIcon.svelte'
    import OracleIcon from './icons/OracleIcon.svelte'
    import PointsIcon from './icons/PointsIcon.svelte'
    import ResupplyIcon from './icons/ResupplyIcon.svelte'
    import RoadIcon from './icons/RoadIcon.svelte'

    let {
        line,
        color,
        replaying,
        dimmed,
        onreplay,
        onhighlight
    }: {
        line: HistoryLine
        color: string
        replaying: boolean
        dimmed: boolean
        onreplay: () => void
        onhighlight: (on: boolean) => void
    } = $props()

    const gameSession = getGameSession()
    const ICON_SIZE = 20
    const entry = $derived(line.entry)
</script>

<div
    class="entry"
    class:replaying
    class:dimmed
    role="button"
    tabindex={dimmed || replaying ? -1 : 0}
    aria-disabled={dimmed || replaying ? 'true' : undefined}
    title={line.actions.length > 1 ? 'Replay these actions' : 'Replay this action'}
    onclick={onreplay}
    onpointerenter={() => onhighlight(true)}
    onpointerleave={() => onhighlight(false)}
    onfocusin={() => onhighlight(true)}
    onfocusout={() => onhighlight(false)}
    in:fade={{ duration: 200 }}
    onkeydown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) {
            return
        }
        event.preventDefault()
        onreplay()
    }}
>
    <span class="icon">
        {#if entry.kind === 'road'}
            <RoadIcon size={ICON_SIZE} {color} />
        {:else if entry.kind === 'city'}
            <CityTileIcon size={ICON_SIZE} {color} />
        {:else if entry.kind === 'resupply'}
            <ResupplyIcon size={ICON_SIZE} />
        {:else}
            <MarketIcon
                size={ICON_SIZE}
                {color}
                state={entry.kind === 'sold-market' ? 'sold' : 'active'}
            />
        {/if}
    </span>
    <span class="text">
        <span class="label">{entry.label}</span>
        {#if entry.detail}
            <span class="detail">{entry.detail}</span>
        {/if}
        {#if entry.foundingMarket}
            <span class="extra"><MarketIcon size={15} {color} />with a free market</span>
        {/if}
        {#each entry.oracleChanges as change (`${change.oracle.q},${change.oracle.r}`)}
            <span class="extra oracle">
                <OracleIcon
                    size={16}
                    color={change.toPlayerId
                        ? gameSession.colors.getPlayerUiColor(change.toPlayerId)
                        : undefined}
                />
                an oracle turns to
                {#if change.toPlayerId}
                    <PlayerName playerId={change.toPlayerId} />
                {:else}
                    a city
                {/if}
            </span>
        {/each}
    </span>
    {#if entry.points}
        <span class="points" class:gain={entry.points > 0}>
            {entry.points > 0 ? '+' : '−'}{Math.abs(entry.points)}
            <PointsIcon size={13} />
        </span>
    {/if}
    {#if replaying}
        <span class="replaying-tag">Replaying</span>
    {/if}
</div>

<style>
    .entry {
        position: relative;
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: start;
        column-gap: 8px;
        padding: 3px 6px 3px 8px;
        border-radius: 8px;
        cursor: pointer;
        transition:
            background-color 120ms,
            opacity 120ms;
    }

    .entry:hover:not(.dimmed),
    .entry:focus-visible {
        background: rgba(107, 63, 29, 0.08);
        outline: none;
    }

    .entry.replaying {
        background: rgba(224, 168, 58, 0.25);
        box-shadow: inset 0 0 0 1px rgba(138, 90, 18, 0.45);
    }

    .entry.dimmed {
        opacity: 0.45;
        cursor: default;
    }

    .icon {
        display: flex;
        padding-top: 1px;
    }

    .text {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        column-gap: 5px;
        row-gap: 2px;
        padding-top: 2px;
        line-height: 1.25;
    }

    .label {
        font-weight: 500;
        color: #4a2c12;
    }

    .detail {
        color: #7a5732;
    }

    .extra {
        display: inline-flex;
        flex-basis: 100%;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        color: #7a5732;
    }

    .points {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding-top: 2px;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        color: #8c6a45;
    }

    .points.gain {
        color: #3f6b2a;
    }

    .replaying-tag {
        position: absolute;
        top: -7px;
        right: 6px;
        padding: 0 6px;
        border-radius: 999px;
        background: #e0a83a;
        color: #3b2208;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }
</style>
