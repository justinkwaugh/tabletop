<script lang="ts">
    import type { GuildRank } from '@tabletop/feudum'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import type { StandingRow } from '$lib/model/guildStandings.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { GuildIconPaths } from '$lib/utils/pieceShapes.js'

    /**
     * Contract, Guild standings: one guild's rail, drawn at its own size and scaled to its place.
     * It shows only what exists: the guild, then its master boxed with the larger marker, stars and
     * a ringed dot for a reeve, or an empty marker outline, solid, with no words; then the lower
     * places held, and muted, the seats with stars and no place. Markers carry no letters, so each
     * place's words are its accessible name and tooltip, and a press says them at the rail's foot,
     * where a touch screen has no tooltip. Spelled out, in the desk's strip, each holder's name
     * follows the stars, a lower place is lettered (J, A), and a seat with no place shows its reason,
     * so nothing needs a hover.
     */
    let {
        row,
        paintOf,
        spelled = false
    }: {
        row: StandingRow
        paintOf: (playerId: string) => SeatPaint
        spelled?: boolean
    } = $props()

    let LeadMarker = $derived(spelled ? 17 : 19)
    const Marker = 13
    /** A lower place's letter, spelled out. */
    const Letters: Readonly<Record<GuildRank, string>> = {
        master: 'M',
        journeyman: 'J',
        apprentice: 'A'
    }

    let master = $derived.by(() => {
        const place = row.places.find((each) => each.rank === 'master')
        if (!place) {
            throw new Error(`No master's place on the ${row.name} track`)
        }
        return place
    })
    let lower = $derived(row.places.filter((place) => place.rank !== 'master' && place.holder))
    let said: string | undefined = $state(undefined)

    function say(words: string) {
        said = said === words ? undefined : words
    }
</script>

{#snippet marker(playerId: string, size: number)}
    <span class="marker" aria-hidden="true">
        <SeatToken kind="marker" paint={paintOf(playerId)} {size} />
    </span>
{/snippet}

{#snippet named(name: string)}
    {#if spelled}
        <span class="name" aria-hidden="true" data-standing-name>{name}</span>
    {/if}
{/snippet}

{#snippet heading()}
    <h3 class="head">
        <svg class="icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d={GuildIconPaths[row.guild]} fill="currentColor"></path>
        </svg>
        {row.name}
    </h3>
{/snippet}

{#snippet open()}
    <p class="open" data-standing-place="master" data-no-master>
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <polygon
                points="12,1 21.6,6.5 21.6,17.5 12,23 2.4,17.5 2.4,6.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
            ></polygon>
        </svg>
        <span class="sr-only">{master.label}</span>
    </p>
{/snippet}

<section class="rail" class:spelled aria-label="{row.name} standing" data-standing-row={row.guild}>
    {#if spelled && !master.holder}
        <!-- Spelled out, an open master shares the heading's line, so a line is left for each seat. -->
        <div class="top">
            {@render heading()}
            {@render open()}
        </div>
    {:else}
        {@render heading()}
    {/if}
    {#if master.holder}
        <button
            type="button"
            class="place lead"
            aria-label={master.label}
            title={master.label}
            data-standing-place="master"
            data-standing-holder={master.holder.playerId}
            data-lead=""
            data-stars={master.holder.stars}
            data-reeve={master.holder.reeve ? '' : undefined}
            onclick={() => say(master.label)}
        >
            {@render marker(master.holder.playerId, LeadMarker)}
            <span aria-hidden="true">★{master.holder.stars}</span>
            {#if master.holder.reeve}
                <span class="reeve" aria-hidden="true"></span>
            {/if}
            {@render named(master.holder.name)}
        </button>
    {:else if !spelled}
        {@render open()}
    {/if}
    {#if lower.length > 0 || row.others.length > 0}
        <div class="rest">
            {#each lower as place (place.rank)}
                {#if place.holder}
                    <button
                        type="button"
                        class="place"
                        aria-label={place.label}
                        title={place.label}
                        data-standing-place={place.rank}
                        data-standing-holder={place.holder.playerId}
                        data-stars={place.holder.stars}
                        data-reeve={place.holder.reeve ? '' : undefined}
                        onclick={() => say(place.label)}
                    >
                        {#if spelled}
                            <span class="rank" aria-hidden="true" data-standing-rank
                                >{Letters[place.rank]}</span
                            >
                        {/if}
                        {@render marker(place.holder.playerId, Marker)}
                        <span aria-hidden="true">★{place.holder.stars}</span>
                        {#if place.holder.reeve}
                            <span class="reeve" aria-hidden="true"></span>
                        {/if}
                        {@render named(place.holder.name)}
                    </button>
                {/if}
            {/each}
            {#each row.others as other (other.playerId)}
                <button
                    type="button"
                    class="place other"
                    aria-label="{row.name}, no place: {other.label}"
                    title={other.label}
                    data-standing-other={other.playerId}
                    data-reason={other.reason}
                    onclick={() => say(`${row.name}, no place: ${other.label}`)}
                >
                    {@render marker(other.playerId, Marker)}
                    <span aria-hidden="true">★{other.stars}</span>
                    {@render named(other.name)}
                    {#if spelled}
                        <span class="reason" aria-hidden="true" data-standing-reason
                            >{other.reason}</span
                        >
                    {/if}
                </button>
            {/each}
        </div>
    {/if}
    <p class="said" class:shown={said !== undefined} aria-live="polite" data-standings-said>
        {said ?? ''}
    </p>
</section>

<style>
    .rail {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 3px;
        width: 100%;
        height: 100%;
        padding: 5px 6px;
        overflow: hidden;
        border: 1px solid var(--feudum-frame);
        border-radius: 8px;
        background: var(--feudum-surface-raised);
        color: var(--feudum-text);
        pointer-events: auto;
    }

    .head {
        display: flex;
        align-items: center;
        gap: 5px;
        font-family: var(--feudum-font-text);
        font-size: 12px;
        font-weight: 700;
        line-height: 15px;
        color: var(--feudum-heading);
    }

    .icon {
        flex: none;
        color: var(--feudum-accent);
    }

    .place {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 1px 3px 1px 1px;
        border: 1px solid transparent;
        border-radius: 6px;
        font-size: 11.5px;
        font-weight: 600;
        line-height: 1;
        white-space: nowrap;
        cursor: help;
    }

    .place.lead {
        width: max-content;
        gap: 4px;
        padding: 1px 4px;
        border-color: var(--feudum-frame);
        background: var(--feudum-accent-soft);
        font-size: 13px;
        font-weight: 700;
    }

    .place.other {
        font-weight: 400;
        color: var(--feudum-text-muted);
    }

    .rest {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px 6px;
    }

    .open {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11.5px;
        color: var(--feudum-text-muted);
    }

    .marker {
        display: inline-flex;
    }

    .top {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0 8px;
    }

    /* Spelled out, a place is one line as wide as the rail at most; a long name ends in an ellipsis. */
    .spelled .place {
        max-width: 100%;
    }

    .spelled .rest {
        gap: 2px 8px;
    }

    .name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .rank,
    .reason {
        flex: none;
        font-weight: 400;
        color: var(--feudum-text-muted);
    }

    .reason {
        font-style: italic;
    }

    .reeve {
        width: 8px;
        height: 8px;
        border: 2px solid var(--feudum-accent);
        border-radius: 50%;
        background: var(--feudum-parchment);
    }

    .said {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        display: none;
        padding: 2px 6px 3px;
        border-top: 1px solid var(--feudum-divider);
        background: var(--feudum-surface-raised);
        font-size: 10.5px;
        line-height: 1.2;
    }

    .said.shown {
        display: block;
    }
</style>
