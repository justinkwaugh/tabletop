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
        onhighlight
    }: {
        line: HistoryLine
        color: string
        onhighlight: (on: boolean) => void
    } = $props()

    const gameSession = getGameSession()
    const ICON_SIZE = 20
    const entry = $derived(line.entry)
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="entry"
    onpointerenter={() => onhighlight(true)}
    onpointerleave={() => onhighlight(false)}
    in:fade={{ duration: 200 }}
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
        transition: background-color 120ms;
    }

    .entry:hover {
        background: rgba(107, 63, 29, 0.06);
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
</style>
