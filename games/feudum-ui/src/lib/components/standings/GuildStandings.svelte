<script lang="ts">
    import type { GuildRank } from '@tabletop/feudum'
    import GuildDie from '$lib/components/pieces/GuildDie.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import type { GuildStandingsView } from '$lib/model/guildStandings.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'

    /**
     * Contract, Guild standings: one row per guild, its die face with no badge, then the track's
     * places from the top, each the holder's influence marker and stars, the master's outlined so
     * the leader reads first and a reeve as a ringed dot; last, muted, the seats with stars and no
     * place. A place's words are its accessible name and tooltip; a press says them in the line
     * under the heading, where a touch screen has no tooltip.
     */
    let {
        view,
        paintOf
    }: {
        view: GuildStandingsView
        paintOf: (playerId: string) => SeatPaint
    } = $props()

    const Die = 26
    const Marker = 16
    const LeadMarker = 18
    const OtherMarker = 13

    const Heads: Readonly<Record<GuildRank, { short: string; full: string }>> = {
        master: { short: 'Master', full: 'Master' },
        journeyman: { short: 'Journeym.', full: 'Journeyman' },
        apprentice: { short: 'Appr.', full: 'Apprentice' }
    }

    const uid = $props.id()
    const headingId = `${uid}-heading`
    let said: string | undefined = $state(undefined)
</script>

{#snippet marker(playerId: string, size: number)}
    <span class="marker" aria-hidden="true">
        <SeatToken kind="marker" paint={paintOf(playerId)} {size} />
    </span>
{/snippet}

<section class="standings" aria-labelledby={headingId} data-guild-standings>
    <div class="head">
        <h3 id={headingId}>Guild standings</h3>
        <small aria-live="polite" data-standings-said>{said ?? ''}</small>
    </div>
    <table>
        <thead>
            <tr>
                <th scope="col"><span class="sr-only">Guild</span></th>
                {#each view.ranks as rank (rank)}
                    <th scope="col"><abbr title={Heads[rank].full}>{Heads[rank].short}</abbr></th>
                {/each}
                <th scope="col">Others</th>
            </tr>
        </thead>
        <tbody>
            {#each view.rows as row (row.guild)}
                <tr data-standing-row={row.guild}>
                    <th scope="row" class="die-cell">
                        <GuildDie guild={row.guild} size={Die} phoneSize={Die} />
                        <span class="sr-only">{row.name}</span>
                    </th>
                    {#each row.places as place (place.rank)}
                        <td data-standing-place={place.rank}>
                            {#if place.holder}
                                {@const lead = place.rank === 'master'}
                                <button
                                    type="button"
                                    class="place"
                                    class:lead
                                    aria-label={place.label}
                                    title={place.label}
                                    data-standing-holder={place.holder.playerId}
                                    data-lead={lead ? '' : undefined}
                                    data-stars={place.holder.stars}
                                    data-reeve={place.holder.reeve ? '' : undefined}
                                    onclick={() => (said = place.label)}
                                >
                                    {@render marker(
                                        place.holder.playerId,
                                        lead ? LeadMarker : Marker
                                    )}
                                    <span aria-hidden="true">★{place.holder.stars}</span>
                                    {#if place.holder.reeve}
                                        <span class="reeve" aria-hidden="true"></span>
                                    {/if}
                                </button>
                            {:else}
                                <span class="sr-only">{place.label}</span>
                                <span class="empty" aria-hidden="true" data-vacant>·</span>
                            {/if}
                        </td>
                    {/each}
                    <td data-standing-others>
                        {#each row.others as other (other.playerId)}
                            <button
                                type="button"
                                class="place other"
                                aria-label="{row.name}, no place: {other.label}"
                                title={other.label}
                                data-standing-other={other.playerId}
                                data-reason={other.reason}
                                onclick={() => (said = `${row.name}, no place: ${other.label}`)}
                            >
                                {@render marker(other.playerId, OtherMarker)}
                                <span aria-hidden="true">★{other.stars}</span>
                            </button>
                        {:else}
                            <span class="sr-only">{row.othersLabel}</span>
                            <span class="empty" aria-hidden="true">·</span>
                        {/each}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</section>

<style>
    .standings {
        padding: 8px 8px 4px;
        border: 1px solid var(--feudum-frame);
        border-radius: 10px;
        background: var(--feudum-surface-raised);
        color: var(--feudum-text);
    }

    .head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 0 8px;
        padding: 0 2px 4px;
    }

    h3 {
        font-family: var(--feudum-font-text);
        font-size: 16px;
        color: var(--feudum-heading);
    }

    small {
        font-size: 12px;
        color: var(--feudum-text-muted);
    }

    table {
        width: 100%;
        border-collapse: collapse;
    }

    th,
    td {
        padding: 3px 2px;
        border-top: 1px solid var(--feudum-divider);
        font-size: 13px;
        text-align: left;
        vertical-align: middle;
    }

    thead th {
        padding-bottom: 1px;
        border: 0;
        font-size: 11.5px;
        font-weight: 400;
        color: var(--feudum-text-muted);
    }

    abbr {
        text-decoration: none;
    }

    .die-cell {
        width: 34px;
    }

    .place {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 1px 4px 1px 2px;
        border: 1px solid transparent;
        border-radius: 6px;
        font-weight: 600;
        line-height: 1;
        white-space: nowrap;
        cursor: help;
    }

    .place.lead {
        border-color: var(--feudum-accent);
        background: var(--feudum-surface);
    }

    .place.other {
        font-size: 12px;
        font-weight: 400;
        color: var(--feudum-text-muted);
    }

    .marker {
        display: inline-flex;
    }

    .reeve {
        width: 8px;
        height: 8px;
        margin-left: 1px;
        border: 2px solid var(--feudum-accent);
        border-radius: 50%;
        background: var(--feudum-parchment);
    }

    .empty {
        color: var(--feudum-text-muted);
    }
</style>
