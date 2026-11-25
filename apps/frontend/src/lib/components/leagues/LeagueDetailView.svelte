<script lang="ts">
    import { listenForCompetitionChanges } from '$lib/services/competitionUpdates'
    import { LatestRequest } from '$lib/utils/latestRequest'
    import { onMount } from 'svelte'
    import {
        Role,
        range,
        ranksByAveragePlace,
        type LeagueAllocatedGroup,
        type LeagueGroupDetail,
        type LeagueSeasonDetail,
        type LeagueSignUpOperation
    } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import {
        leagueLevelText,
        leagueSeasonStatusColor,
        leagueSeasonStatusText
    } from '$lib/utils/leaguePresentation'
    import { accountName } from '$lib/utils/accountName'
    import LeagueFormatCard from './LeagueFormatCard.svelte'
    import LeagueSignUpPanel from './LeagueSignUpPanel.svelte'
    import LeagueManageMenu from './LeagueManageMenu.svelte'
    import LeagueForm from './LeagueForm.svelte'
    import LeagueGroupTable from './LeagueGroupTable.svelte'
    import RichMessage from '$lib/components/RichMessage.svelte'
    import { m } from '$lib/paraglide/messages'

    let { id, season: seasonNumber }: { id: string; season?: number } = $props()
    const { api, authorizationService, libraryService, notificationService } = getAppContext()
    let user = $derived(authorizationService.getSessionUser())
    let isAdmin = $derived(user?.roles.includes(Role.Admin))
    let now = $state(Date.now())
    let detail = $state<LeagueSeasonDetail>()
    let league = $derived(detail?.league)
    let season = $derived(detail?.season)
    let title = $derived(league ? libraryService.titlesById[league.rules.titleId] : undefined)
    let isCurrent = $derived(season !== undefined && season.number === league?.currentSeason)
    let seasonProgress = $derived.by(() => {
        const groups = detail?.groups ?? []
        return {
            finished: groups.reduce((total, group) => total + group.finishedGames, 0),
            total: groups.reduce((total, group) => total + group.totalGames, 0),
            active: groups.reduce((total, group) => total + group.activeGames, 0),
            activeProgress: groups.reduce((total, group) => total + (group.activeProgress ?? 0), 0)
        }
    })
    let groupLevels = $derived.by(() => {
        const levels: LeagueGroupDetail[][] = []
        for (const group of detail?.groups ?? []) (levels[group.level] ??= []).push(group)
        return levels
    })
    let preview = $state<LeagueAllocatedGroup[] | null>()
    let editingDraft = $state(false)
    let loadError = $state('')
    let actionError = $state('')
    let busy = $state(false)
    const requests = new LatestRequest()

    function username(userId: string) {
        return accountName(detail?.usernames ?? {}, userId)
    }

    async function refresh() {
        const current = requests.begin()
        try {
            const value = await api.getLeague(id, seasonNumber)
            if (current()) {
                detail = value
                loadError = ''
            }
        } catch (failure) {
            if (current())
                loadError = failure instanceof Error ? failure.message : m.leagues_load_failed()
        }
    }

    async function run(action: () => Promise<unknown>, failureText: () => string) {
        busy = true
        actionError = ''
        try {
            await action()
        } catch (failure) {
            actionError = failure instanceof Error ? failure.message : failureText()
        } finally {
            await refresh()
            busy = false
        }
    }

    function scheduleSignUp(operation: LeagueSignUpOperation, closesAt: number) {
        preview = undefined
        return run(
            () => api.scheduleLeagueSignUp(id, operation, closesAt),
            m.leagues_update_sign_up_failed
        )
    }

    async function loadPreview() {
        await run(async () => {
            preview = (await api.previewLeagueAllocation(id)).groups
        }, m.leagues_preview_failed)
    }

    onMount(() => {
        const clock = setInterval(() => {
            now = Date.now()
        }, 1000)
        const stopUpdates = listenForCompetitionChanges(notificationService, refresh, {
            league: (leagueId) => leagueId === id,
            // Until the first load names the Groups, any Tournament update may be one of them.
            tournament: (tournamentId) =>
                detail?.groups.some((group) => group.tournamentId === tournamentId) ?? true
        })
        void refresh()
        return () => {
            clearInterval(clock)
            stopUpdates()
            requests.cancel()
        }
    })
</script>

{#snippet finishedCount(text: string)}<span class="text-lg font-semibold tabular-nums">{text}</span
    >{/snippet}
{#snippet promotedMark()}<span class="text-green-700 dark:text-green-400">▲</span>{/snippet}
{#snippet relegatedMark()}<span class="ml-2 text-red-600 dark:text-red-400">▼</span>{/snippet}

<svelte:head
    ><title
        >{league
            ? m.leagues_detail_page_title({ name: league.name })
            : m.leagues_detail_page_title_loading()}</title
    ></svelte:head
>
<main
    class="mx-auto max-w-7xl px-4 pb-10 pt-4 text-gray-900 dark:text-gray-100 sm:px-6 sm:pt-5"
    aria-busy={!detail && !loadError}
>
    <a
        class="text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
        href="/leagues">{m.leagues_back_to_leagues()}</a
    >
    {#each [loadError, actionError, season?.error ?? ''].filter(Boolean) as message, i (i)}
        <p role="alert" class="mt-3 text-sm text-red-600 dark:text-red-300">{message}</p>
    {/each}
    {#if league && detail}
        {#snippet format()}
            <LeagueFormatCard
                {league}
                titleName={title?.info.metadata.name ?? league.rules.titleId}
                configurator={title?.info.configurator}
            />
        {/snippet}
        <header class="mt-4 border-b border-gray-200 pb-4 dark:border-gray-700/60">
            <div class="flex flex-wrap items-center justify-between gap-4">
                <div class="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
                    {#if title?.info.thumbnailUrl}
                        <img
                            src={title.info.thumbnailUrl}
                            alt=""
                            width="72"
                            height="72"
                            class="size-16 shrink-0 object-contain sm:size-18"
                        />
                    {/if}
                    <div class="min-w-0">
                        <h1
                            class="font-tournament break-words text-2xl font-semibold leading-tight sm:text-3xl"
                        >
                            {league.name}
                        </h1>
                        <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                {title?.info.metadata.name ?? league.rules.titleId}
                            </p>
                            {#if season?.status !== 'signUp'}
                                <details class="relative">
                                    <summary
                                        class="flex cursor-pointer list-none items-center gap-0.5 text-xs text-blue-700 hover:text-blue-500 dark:text-blue-300"
                                        >{m.leagues_format_heading()}
                                        <svg
                                            aria-hidden="true"
                                            class="size-3"
                                            viewBox="0 0 16 16"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="1.5"
                                            ><path
                                                d="m4 6 4 4 4-4"
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                            ></path></svg
                                        ></summary
                                    >
                                    <div
                                        class="absolute left-0 z-20 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-lg bg-white shadow-lg dark:bg-gray-800"
                                    >
                                        {@render format()}
                                    </div>
                                </details>
                            {/if}
                        </div>
                        <p
                            class="mt-1.5 inline-flex items-center gap-1.5 text-xs {leagueSeasonStatusColor(
                                season,
                                now
                            )}"
                        >
                            <span class="size-1.5 rounded-full bg-current" aria-hidden="true"
                            ></span>
                            {season
                                ? m.leagues_season_with_status({
                                      season: m.leagues_season_name({ number: season.number }),
                                      status: leagueSeasonStatusText(season, now)
                                  })
                                : leagueSeasonStatusText(season, now)}
                        </p>
                    </div>
                </div>
                <div class="flex shrink-0 flex-wrap items-center gap-2">
                    {#if season && (season.status === 'inProgress' || season.status === 'starting') && seasonProgress.total}
                        <div class="w-full sm:w-60 sm:text-right">
                            <p class="text-sm">
                                <RichMessage
                                    parts={m.leagues_detail_games_finished.parts({
                                        finished: seasonProgress.finished,
                                        total: seasonProgress.total
                                    })}
                                    markup={{ count: finishedCount }}
                                />
                            </p>
                            <div
                                class="mt-1 flex h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                                role="progressbar"
                                aria-label={m.leagues_detail_games_finished_label()}
                                aria-valuemin={0}
                                aria-valuemax={seasonProgress.total}
                                aria-valuenow={seasonProgress.finished}
                            >
                                <div
                                    class="h-full bg-blue-600"
                                    style:width={`${(seasonProgress.finished / seasonProgress.total) * 100}%`}
                                ></div>
                                <div
                                    class="h-full bg-blue-300 dark:bg-blue-800"
                                    title={m.leagues_progress_in_progress()}
                                    style:width={`${(seasonProgress.activeProgress / seasonProgress.total) * 100}%`}
                                ></div>
                            </div>
                            <p class="mt-1 text-xs text-gray-500">
                                {m.leagues_detail_active_games({ count: seasonProgress.active })}
                            </p>
                        </div>
                    {/if}
                    {#if isAdmin}
                        <LeagueManageMenu
                            {league}
                            season={isCurrent ? season : undefined}
                            {busy}
                            {editingDraft}
                            onedit={() => (editingDraft = !editingDraft)}
                            onschedule={scheduleSignUp}
                            onpreview={loadPreview}
                            onsignuppolicy={(policy) =>
                                run(
                                    () => api.updateLeagueSignUpPolicy(id, policy),
                                    m.leagues_save_sign_up_policy_failed
                                )}
                            oncancel={() =>
                                run(
                                    () => api.cancelLeagueSeason(id),
                                    m.leagues_cancel_season_failed
                                )}
                        />
                    {/if}
                </div>
            </div>
            {#if league.description}<p
                    class="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-400"
                >
                    {league.description}
                </p>{/if}
            {#if league.currentSeason !== undefined && league.currentSeason > 0}
                <div class="mt-3 flex flex-wrap items-center gap-1.5">
                    {#if league.currentSeason !== undefined && league.currentSeason > 0}
                        <nav
                            aria-label={m.leagues_detail_seasons_label()}
                            class="flex flex-wrap gap-1.5"
                        >
                            {#each range(0, league.currentSeason + 1) as number (number)}
                                <a
                                    href={number === league.currentSeason
                                        ? `/leagues/${league.id}`
                                        : `/leagues/${league.id}?season=${number}`}
                                    aria-current={number === season?.number ? 'page' : undefined}
                                    class="rounded-full border px-2.5 py-0.5 text-xs {number ===
                                    season?.number
                                        ? 'border-blue-500 text-blue-700 dark:text-blue-300'
                                        : 'border-gray-300 text-gray-500 hover:text-gray-900 dark:border-gray-600 dark:text-gray-400 dark:hover:text-gray-100'}"
                                    >{m.leagues_season_name({ number })}</a
                                >
                            {/each}
                        </nav>
                    {/if}
                </div>
            {/if}
        </header>

        {#if isAdmin && league.status === 'draft' && editingDraft}
            <section
                aria-label={m.leagues_detail_edit_draft_label()}
                class="mt-4 max-w-2xl rounded-md border border-gray-200 p-4 dark:border-gray-700"
            >
                {#key league.revision}
                    <LeagueForm
                        {league}
                        disabled={busy}
                        oncancel={() => (editingDraft = false)}
                        onsaved={() => {
                            editingDraft = false
                            void refresh()
                        }}
                    />
                {/key}
            </section>
        {/if}

        {#if isAdmin && preview !== undefined}
            <section
                aria-label={m.leagues_detail_preview_label()}
                class="mt-3 rounded-md border border-dashed border-gray-300 p-3 text-xs dark:border-gray-600"
            >
                {#if preview === null}
                    <p>{m.leagues_detail_preview_too_few()}</p>
                {:else}
                    <p class="mb-2 text-gray-500">
                        {m.leagues_detail_preview_intro()}
                    </p>
                    <div class="grid gap-3 sm:grid-cols-3">
                        {#each preview as group (group.groupId)}
                            <div>
                                <p class="font-medium">
                                    {m.leagues_group_name({ group: group.groupId })}
                                </p>
                                <p class="text-gray-500">
                                    {group.entrantIds.map(username).join(', ')}
                                </p>
                            </div>
                        {/each}
                    </div>
                {/if}
            </section>
        {/if}

        {#if season?.status === 'signUp' && detail.summary}
            <div class="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <LeagueSignUpPanel
                    {season}
                    summary={detail.summary}
                    leagueId={league.id}
                    usernames={detail.usernames}
                    userId={user?.id}
                    {now}
                    {busy}
                    onsignup={() =>
                        run(() => api.actOnLeague(id, 'signUp'), m.leagues_sign_up_failed)}
                    onwithdraw={() =>
                        run(() => api.actOnLeague(id, 'withdraw'), m.leagues_withdraw_failed)}
                />
                {@render format()}
            </div>
        {:else if season && detail.groups.length}
            <section
                aria-label={m.leagues_detail_season_groups_label({ number: season.number })}
                class="mt-5"
            >
                {#if season.status === 'finished' && season.seeding}
                    <p class="mb-3 text-xs text-gray-500">
                        {m.leagues_detail_seeding_letters({ number: season.number + 1 })}
                    </p>
                {:else if season.status === 'finished'}
                    <p class="mb-3 text-xs text-gray-500">
                        <RichMessage
                            parts={m.leagues_detail_movement_legend.parts({
                                number: season.number + 1
                            })}
                            markup={{ promoted: promotedMark, relegated: relegatedMark }}
                        />
                    </p>
                {/if}
                <div class="space-y-5">
                    {#each groupLevels as groups, level (level)}
                        <div>
                            {#if league.shape === 'pyramid' && !season.seeding}
                                <div class="mb-3 flex items-center gap-3">
                                    <hr class="flex-1 border-gray-200 dark:border-gray-700/60" />
                                    <h3
                                        class="text-sm font-medium text-gray-500 dark:text-gray-400"
                                    >
                                        {leagueLevelText(level)}
                                    </h3>
                                    <hr class="flex-1 border-gray-200 dark:border-gray-700/60" />
                                </div>
                            {/if}
                            <div class="flex flex-wrap justify-center gap-3">
                                {#each groups as group (group.groupId)}
                                    <LeagueGroupTable
                                        {group}
                                        gamesPerEntrant={season.rules.gamesPerEntrant}
                                        ranksByAveragePlace={ranksByAveragePlace(season.rules)}
                                        usernames={detail.usernames}
                                        userId={user?.id}
                                    />
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>
            </section>
        {:else if season?.status === 'cancelled'}
            <p class="mt-5 text-sm text-gray-500">
                {isCurrent
                    ? m.leagues_detail_cancelled_current({ number: season.number })
                    : m.leagues_detail_cancelled({ number: season.number })}
            </p>
        {:else if !season}
            <p class="mt-5 text-sm text-gray-500">{m.leagues_detail_not_opened()}</p>
        {/if}
    {/if}
</main>
