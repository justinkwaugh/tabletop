<script lang="ts">
    import { onMount } from 'svelte'
    import type { Tournament } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { listenForTournamentChanges } from '$lib/services/tournamentUpdates'
    import { loadTitleTournaments } from '$lib/services/titleTournaments'
    import { tournamentSummaryText, tournamentStatusText } from '$lib/utils/tournamentPresentation'
    import TitleSection from '$lib/components/TitleSection.svelte'
    import { ArrowRightOutline } from 'flowbite-svelte-icons'

    let { titleId }: { titleId: string } = $props()
    const { api, notificationService } = getAppContext()
    let tournaments = $state<Tournament[]>([])
    let cursor = $state<string>()
    let busy = $state(true)
    let failed = $state(false)
    let now = $state(Date.now())
    let request = 0

    async function load(after?: string) {
        const current = ++request
        busy = true
        failed = false
        try {
            const result = await loadTitleTournaments(api, titleId, after)
            if (current !== request) return
            tournaments = after ? [...tournaments, ...result.tournaments] : result.tournaments
            cursor = result.nextCursor
        } catch {
            if (current === request) failed = true
        } finally {
            if (current === request) busy = false
        }
    }

    onMount(() => {
        void load()
        const timer = setInterval(() => (now = Date.now()), 1000)
        const unsubscribe = listenForTournamentChanges(notificationService, () => load())
        return () => {
            request++
            clearInterval(timer)
            unsubscribe()
        }
    })
</script>

<TitleSection
    title="Tournaments"
    count={!busy && !failed && !cursor ? tournaments.length : undefined}
>
    {#snippet action()}
        <a class="browse" href={`/tournaments?titleId=${encodeURIComponent(titleId)}`}
            >View all tournaments <ArrowRightOutline class="h-4 w-4" /></a
        >
    {/snippet}
    {#if busy && !tournaments.length}
        <p class="empty" role="status">Loading tournaments…</p>
    {:else if failed}
        <p class="empty" role="alert">
            Tournaments couldn’t load. <button onclick={() => load()}>Try again</button>
        </p>
    {:else if !tournaments.length}
        <p class="empty">No tournaments to show for this game right now.</p>
    {/if}
    <div class="tournaments">
        {#each tournaments as tournament (tournament.id)}
            <a class="tournament" href={`/tournaments/${tournament.id}`}>
                <div class="status-row">
                    <span>{tournamentStatusText(tournament, now)}</span><span class="entrants"
                        >{tournament.entrants.length}{tournament.rules.registration.capacity
                            ? ` / ${tournament.rules.registration.capacity}`
                            : ''} joined</span
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
    .tournaments {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
    }
    .tournament {
        display: block;
        padding: 24px;
        background: var(--color-gray-800);
        border: 1px solid var(--color-gray-700);
        border-radius: 12px;
        transition:
            border-color 200ms,
            background-color 200ms;
    }
    .tournament:hover {
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
    .entrants {
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
        .tournaments {
            grid-template-columns: 1fr;
        }
    }
</style>
