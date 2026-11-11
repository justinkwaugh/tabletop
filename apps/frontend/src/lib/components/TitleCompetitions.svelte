<script lang="ts">
    import { everyCompetition, listenForCompetitionChanges } from '$lib/services/competitionUpdates'
    import { LatestRequest } from '$lib/utils/latestRequest'
    import { onMount } from 'svelte'
    import type { LeagueListEntry, Tournament } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { loadTitleTournaments } from '$lib/services/titleTournaments'
    import {
        tournamentRosterText,
        tournamentSummaryText,
        tournamentStatusText
    } from '$lib/utils/tournamentPresentation'
    import {
        leagueClosesInText,
        leagueListStatusText,
        leagueMyPlaceText,
        leagueRosterText,
        leagueShapeText,
        leagueShowsSignUpDeadline,
        sortLeaguesByName
    } from '$lib/utils/leaguePresentation'
    import TitleSection from '$lib/components/TitleSection.svelte'
    import { ArrowRightOutline } from 'flowbite-svelte-icons'

    let { titleId }: { titleId: string } = $props()
    const { api, notificationService } = getAppContext()
    let tournaments = $state<Tournament[]>([])
    let cursor = $state<string>()
    let busy = $state(true)
    let failed = $state(false)
    let now = $state(Date.now())
    const requests = new LatestRequest()
    let leagues = $state<LeagueListEntry[]>([])
    let leaguesBusy = $state(true)
    let leaguesFailed = $state(false)
    const leagueRequests = new LatestRequest()

    async function loadLeagues() {
        const current = leagueRequests.begin()
        leaguesFailed = false
        try {
            const result = await api.listLeagues()
            if (!current()) return
            leagues = sortLeaguesByName(
                result.leagues.filter(
                    ({ league, season }) =>
                        league.rules.titleId === titleId && season?.status !== 'cancelled'
                )
            )
        } catch {
            if (current()) leaguesFailed = true
        } finally {
            if (current()) leaguesBusy = false
        }
    }

    const failedText = $derived(
        failed && leaguesFailed ? 'Tournaments and leagues' : failed ? 'Tournaments' : 'Leagues'
    )

    function retry() {
        if (failed) void load()
        if (leaguesFailed) void loadLeagues()
    }

    async function load(after?: string) {
        const current = requests.begin()
        busy = true
        failed = false
        try {
            const result = await loadTitleTournaments(api, titleId, after)
            if (!current()) return
            tournaments = after ? [...tournaments, ...result.tournaments] : result.tournaments
            cursor = result.nextCursor
        } catch {
            if (current()) failed = true
        } finally {
            if (current()) busy = false
        }
    }

    onMount(() => {
        void load()
        void loadLeagues()
        const timer = setInterval(() => (now = Date.now()), 1000)
        const unsubscribe = listenForCompetitionChanges(notificationService, () => load(), {
            tournament: everyCompetition
        })
        const unsubscribeLeagues = listenForCompetitionChanges(notificationService, loadLeagues, {
            league: everyCompetition
        })
        return () => {
            requests.cancel()
            leagueRequests.cancel()
            clearInterval(timer)
            unsubscribe()
            unsubscribeLeagues()
        }
    })
</script>

<TitleSection
    title="Tournaments and Leagues"
    count={!busy && !failed && !cursor && !leaguesBusy && !leaguesFailed
        ? tournaments.length + leagues.length
        : undefined}
>
    {#snippet action()}
        <div class="browse-links">
            <a class="browse" href={`/tournaments?titleId=${encodeURIComponent(titleId)}`}
                >All tournaments <ArrowRightOutline class="h-4 w-4" /></a
            ><a class="browse" href="/leagues">All leagues <ArrowRightOutline class="h-4 w-4" /></a>
        </div>
    {/snippet}
    {#if (busy || leaguesBusy) && !tournaments.length && !leagues.length}
        <p class="empty" role="status">Loading tournaments and leagues…</p>
    {:else if failed || leaguesFailed}
        <p class="empty" role="alert">
            {failedText} couldn’t load. <button onclick={retry}>Try again</button>
        </p>
    {:else if !tournaments.length && !leagues.length}
        <p class="empty">No tournaments or leagues to show for this game right now.</p>
    {/if}
    <div class="competitions">
        {#each leagues as entry (entry.league.id)}
            {@const { league, season } = entry}
            <a class="competition" href={`/leagues/${encodeURIComponent(league.id)}`}>
                <div class="status-row">
                    <span>{leagueListStatusText(entry, now)}</span>{#if season}<span class="roster"
                            >{leagueRosterText(season)}</span
                        >{/if}
                </div>
                <h3>{league.name}</h3>
                {#if season?.myPlace}
                    <p>{leagueMyPlaceText(season.myPlace)}</p>
                {:else if leagueShowsSignUpDeadline(season)}
                    <p>{leagueClosesInText(season.signUpClosesAt, now)}</p>
                {/if}
                <div class="details">
                    <span
                        >{leagueShapeText(league.shape)} league · {league.rules.tableSize} players per
                        game · {league.rules.gamesPerEntrant} games each</span
                    ><ArrowRightOutline class="h-5 w-5 shrink-0" />
                </div>
            </a>
        {/each}
        {#each tournaments as tournament (tournament.id)}
            <a class="competition" href={`/tournaments/${tournament.id}`}>
                <div class="status-row">
                    <span>{tournamentStatusText(tournament, now)}</span><span class="roster"
                        >{tournamentRosterText(tournament)} joined</span
                    >
                </div>
                <h3>{tournament.name}</h3>
                <p>{tournamentSummaryText(tournament, now)}</p>
                <div class="details">
                    <span
                        >{tournament.rules.tableSize} players per game · {tournament.format
                            .stages[0].gamesPerEntrant} games each</span
                    ><ArrowRightOutline class="h-5 w-5 shrink-0" />
                </div>
            </a>
        {/each}
    </div>
    {#if cursor && !failed}<button class="load-more" disabled={busy} onclick={() => load(cursor)}
            >{busy ? 'Loading…' : 'More tournaments'}</button
        >{/if}
</TitleSection>

<style>
    .browse-links {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 20px;
    }
    .browse {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--color-blue-300);
        font-size: 14px;
    }
    .browse:hover {
        text-decoration: underline;
    }
    .competitions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
    }
    .competition {
        display: block;
        padding: 24px;
        background: var(--color-gray-800);
        border: 1px solid var(--color-gray-700);
        border-radius: 12px;
        transition:
            border-color 200ms,
            background-color 200ms;
    }
    .competition:hover {
        border-color: var(--color-highlight-border);
        background: #293950;
    }
    .status-row {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 12px;
        color: var(--color-blue-300);
    }
    .roster {
        color: var(--color-gray-400);
    }
    h3 {
        margin-top: 16px;
        font-family: 'Inter', sans-serif;
        font-size: 20px;
        font-weight: 600;
        letter-spacing: -0.02em;
    }
    p {
        margin-top: 8px;
        color: var(--color-gray-400);
        font-size: 14px;
        line-height: 1.6;
    }
    .details {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-top: 24px;
        font-size: 13px;
        color: var(--color-gray-300);
    }
    .empty {
        padding: 28px;
        margin: 0;
        border: 1px solid var(--color-gray-800);
        background: #1e293b40;
        border-radius: 12px;
    }
    .empty button,
    .load-more {
        color: var(--color-blue-300);
    }
    .load-more {
        display: block;
        margin: 24px auto 0;
        font-size: 14px;
    }
    a:focus-visible,
    button:focus-visible {
        outline: 2px solid var(--color-blue-300);
        outline-offset: 4px;
    }
    @media (max-width: 700px) {
        .competitions {
            grid-template-columns: 1fr;
        }
    }
</style>
