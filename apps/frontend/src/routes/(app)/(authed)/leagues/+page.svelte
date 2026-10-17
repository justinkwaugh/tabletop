<script lang="ts">
    import CompetitionHeading from '$lib/components/CompetitionHeading.svelte'
    import { onMount } from 'svelte'
    import { goto } from '$app/navigation'
    import { Modal } from 'flowbite-svelte'
    import { Role, type LeagueListEntry, type LeagueSeasonSummary } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import LeagueForm from '$lib/components/leagues/LeagueForm.svelte'
    import { listenForLeagueChanges } from '$lib/services/leagueUpdates'
    import {
        leagueClosesInText,
        leagueMyPlaceText,
        leagueSeasonName,
        leagueSeasonStatusColor,
        leagueSeasonStatusText,
        leagueShapeText
    } from '$lib/utils/leaguePresentation'

    const { api, authorizationService, libraryService, notificationService } = getAppContext()
    let isAdmin = $derived(authorizationService.getSessionUser()?.roles.includes(Role.Admin))
    let leagues = $state<LeagueListEntry[]>([])
    let now = $state(Date.now())
    let busy = $state(true)
    let error = $state('')
    let creating = $state(false)
    const placeClasses = {
        signedUp: 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300',
        held: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
        inGroup: 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
    }

    function progressText(season: LeagueSeasonSummary) {
        if (season.status !== 'signUp') return `${season.players} players`
        return season.players >= season.minimumPlayers
            ? `${season.players} signed up`
            : `${season.players} of ${season.minimumPlayers} needed`
    }

    async function load() {
        try {
            leagues = (await api.listLeagues()).leagues.sort((a, b) =>
                a.league.name.localeCompare(b.league.name)
            )
        } catch (failure) {
            error = failure instanceof Error ? failure.message : 'Could not load leagues'
        } finally {
            busy = false
        }
    }

    onMount(() => {
        const clock = setInterval(() => (now = Date.now()), 30_000)
        const stop = listenForLeagueChanges(notificationService, load)
        void load()
        return () => {
            clearInterval(clock)
            stop()
        }
    })
</script>

<svelte:head><title>Leagues · Tabletop</title></svelte:head>
<main class="collection-page pb-10 text-gray-900 dark:text-gray-100">
    <header class="collection-header flex items-center gap-3">
        <CompetitionHeading current="leagues" />
        {#if isAdmin}
            <button
                onclick={() => (creating = true)}
                aria-label="Create league"
                title="Create league"
                class="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
                <svg
                    aria-hidden="true"
                    class="size-5"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    ><path d="M10 4v12M4 10h12" stroke-linecap="round"></path></svg
                >
            </button>
        {/if}
    </header>
    <div class="border-t border-gray-200 pt-5 dark:border-gray-700/60" aria-busy={busy}>
        {#if error}<p role="alert" class="mb-4 text-sm text-red-600 dark:text-red-300">
                {error}
            </p>{/if}
        {#if !busy && !error && !leagues.length}
            <div class="rounded-xl bg-gray-50 px-6 py-14 text-center dark:bg-gray-800/30">
                <p class="text-sm text-gray-500 dark:text-gray-400">No leagues yet.</p>
            </div>
        {/if}
        <div class="columns-1 gap-3 sm:columns-2">
            {#each leagues as { league, season } (league.id)}
                {@const thumbnail = libraryService.getThumbnailForTitle(league.rules.titleId)}
                <a
                    href={`/leagues/${league.id}`}
                    class="mb-3 flex break-inside-avoid flex-col overflow-hidden rounded-md border-4 border-gray-200 bg-white p-3 transition-colors hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 dark:border-gray-800 dark:bg-gray-800 dark:hover:border-blue-500/70"
                >
                    <div class="mb-2 flex items-center justify-between gap-3 text-xs">
                        <span
                            class="inline-flex items-center gap-1.5 {league.status === 'draft'
                                ? 'text-gray-500'
                                : leagueSeasonStatusColor(season, now)}"
                            ><span class="size-1.5 rounded-full bg-current"
                            ></span>{league.status === 'draft'
                                ? 'Draft'
                                : season
                                  ? `${leagueSeasonName(season)} · ${leagueSeasonStatusText(season, now)}`
                                  : 'Not open yet'}</span
                        >
                        <span
                            class="rounded bg-gray-100 px-1.5 py-0.5 text-[0.6rem] leading-none text-gray-500 dark:bg-gray-700/60 dark:text-gray-400"
                            >{leagueShapeText(league.shape)}</span
                        >
                    </div>
                    <div class="flex items-center gap-3">
                        {#if thumbnail}
                            <img
                                src={thumbnail}
                                alt=""
                                loading="lazy"
                                width="64"
                                height="64"
                                class="size-16 shrink-0 rounded-[5px] object-contain"
                            />
                        {/if}
                        <div class="min-w-0">
                            <h2
                                class="font-tournament break-words text-[20px] font-normal leading-5 dark:text-gray-200"
                            >
                                {league.name}
                            </h2>
                            <p
                                class="mt-1 font-tournament text-[calc(0.7rem+2px)] leading-[0.8rem] text-gray-600"
                            >
                                {libraryService.getNameForTitle(league.rules.titleId)}
                            </p>
                        </div>
                    </div>
                    {#if season}
                        <p class="mt-3 text-xs text-gray-600 dark:text-gray-300">
                            <span class="font-medium">{progressText(season)}</span>
                            {#if season.status === 'signUp' && !season.undersubscribed}
                                <span class="mx-1 text-gray-400 dark:text-gray-600">·</span
                                >{leagueClosesInText(season.signUpClosesAt, now)}
                            {/if}
                        </p>
                        {#if season.status === 'signUp'}
                            <div
                                class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                                aria-hidden="true"
                            >
                                <div
                                    class="h-full rounded-full {season.players >=
                                    season.minimumPlayers
                                        ? 'bg-green-600'
                                        : 'bg-blue-600'}"
                                    style:width={`${Math.min(100, (season.players / season.minimumPlayers) * 100)}%`}
                                ></div>
                            </div>
                        {/if}
                        {#if season.myPlace}
                            <p
                                class="mt-3 rounded px-2 py-1 text-xs {placeClasses[
                                    season.myPlace.status
                                ]}"
                            >
                                {leagueMyPlaceText(season.myPlace)}
                            </p>
                        {/if}
                    {/if}
                    <p class="mt-3 text-[11px] text-gray-500">
                        {league.rules.tableSize} players per game · {league.rules.gamesPerEntrant} games
                        each · groups of {league.rules.sizes.groupSize}
                    </p>
                </a>
            {/each}
        </div>
    </div>
</main>

{#if isAdmin && creating}
    <Modal
        bind:open={creating}
        size="xs"
        autoclose={false}
        class="w-full"
        outsideclose
        dismissable={false}
        aria-label="Create league"
    >
        <LeagueForm
            oncancel={() => (creating = false)}
            onsaved={(league) => {
                creating = false
                void goto(`/leagues/${league.id}`)
            }}
        />
    </Modal>
{/if}
