<script lang="ts">
    import { onMount } from 'svelte'
    import { Hr } from 'flowbite-svelte'
    import { Role, type Tournament, type TournamentListQuery } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { listenForTournamentChanges } from '$lib/services/tournamentUpdates'
    import { gameCardOptions } from '$lib/utils/gameOptions'
    import {
        tournamentFormatText,
        tournamentRegistrationText,
        tournamentStatusText,
        tournamentStatusColor
    } from '$lib/utils/tournamentPresentation'

    const { api, authorizationService, libraryService, notificationService } = getAppContext()
    let isAdmin = $derived(authorizationService.getSessionUser()?.roles.includes(Role.Admin))
    let scope = $state<TournamentListQuery['scope']>('mine')
    let chooseInitialScope = true
    let titleId = $state('')
    let titles = $derived.by(() => {
        const user = authorizationService.getSessionUser()
        return user ? libraryService.getTitles(user) : []
    })
    const selectedTabClasses: Record<TournamentListQuery['scope'], string> = {
        mine: 'border-orange-500 text-orange-700 dark:text-orange-400',
        open: 'border-green-500 text-green-700 dark:text-green-400',
        inProgress: 'border-blue-500 text-blue-700 dark:text-blue-400',
        draft: 'border-red-500 text-red-700 dark:text-red-400'
    }
    const standardTabs: { scope: TournamentListQuery['scope']; label: string }[] = [
        { scope: 'mine', label: 'Mine' },
        { scope: 'open', label: 'Open' },
        { scope: 'inProgress', label: 'In progress' }
    ]
    let tabs = $derived(
        isAdmin ? [...standardTabs, { scope: 'draft' as const, label: 'Drafts' }] : standardTabs
    )
    let tournaments = $state<Tournament[]>([])
    let cursor = $state<string>()
    let pageStart: string | undefined
    let busy = $state(true)
    let error = $state('')
    let request = 0
    let emptyText = $derived(
        titleId
            ? 'No tournaments match this game in this tab.'
            : scope === 'mine'
              ? 'Your tournaments will appear here when you join one.'
              : scope === 'open'
                ? 'No tournaments are open for registration right now.'
                : scope === 'inProgress'
                  ? 'No tournaments are in progress right now.'
                  : 'No drafts. Create a tournament to get started.'
    )

    async function refresh(after = pageStart) {
        const current = ++request
        pageStart = after
        busy = true
        error = ''
        try {
            let result = await api.listTournaments({ scope, after, titleId: titleId || undefined })
            if (current !== request) return
            if (chooseInitialScope) {
                chooseInitialScope = false
                if (!result.tournaments.length) {
                    scope = 'open'
                    result = await api.listTournaments({ scope })
                    if (current !== request) return
                }
            }
            tournaments = result.tournaments
            cursor = result.nextCursor
        } catch (failure) {
            if (current === request)
                error = failure instanceof Error ? failure.message : 'Could not load tournaments'
        } finally {
            if (current === request) busy = false
        }
    }

    function selectTab(selected: TournamentListQuery['scope']) {
        chooseInitialScope = false
        if (selected === scope) return
        scope = selected
        resetResults()
    }

    function resetResults() {
        chooseInitialScope = false
        pageStart = undefined
        cursor = undefined
        void refresh()
    }

    function moveTab(event: KeyboardEvent, index: number) {
        let next: number
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
        else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = tabs.length - 1
        else return
        event.preventDefault()
        selectTab(tabs[next].scope)
        document.getElementById(`tournament-tab-${scope}`)?.focus()
    }

    onMount(() => {
        const unsubscribe = listenForTournamentChanges(notificationService, () => refresh())
        void refresh()
        return () => {
            request++
            unsubscribe()
        }
    })
</script>

<svelte:head><title>Tournaments · Tabletop</title></svelte:head>
<main class="mx-auto max-w-6xl px-4 pb-10 pt-4 text-gray-900 dark:text-gray-100 sm:px-6 sm:pt-5">
    <header class="flex items-center gap-3">
        <h1
            class="font-tournament text-3xl font-semibold leading-tight tracking-normal sm:text-4xl"
        >
            Tournaments
        </h1>
        {#if isAdmin}
            <a
                href="/tournaments/new"
                aria-label="Create tournament"
                title="Create tournament"
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
            </a>
        {/if}
    </header>
    <div
        class="mt-4 flex flex-wrap items-start justify-between gap-x-5 gap-y-3 border-b border-gray-200 dark:border-gray-700/60"
    >
        <div
            role="tablist"
            aria-label="Tournaments"
            class="order-2 flex w-full gap-5 sm:order-1 sm:w-auto sm:gap-7"
        >
            {#each tabs as tab, index (tab.scope)}
                <button
                    role="tab"
                    id={`tournament-tab-${tab.scope}`}
                    aria-selected={scope === tab.scope}
                    aria-controls="tournament-results"
                    tabindex={scope === tab.scope ? 0 : -1}
                    onclick={() => selectTab(tab.scope)}
                    onkeydown={(event) => moveTab(event, index)}
                    class="relative -mb-px whitespace-nowrap border-b-2 px-0.5 pb-3 pt-1 text-sm font-medium transition-colors focus-visible:rounded-t focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 {scope ===
                    tab.scope
                        ? selectedTabClasses[tab.scope]
                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'}"
                    >{tab.label}</button
                >
            {/each}
        </div>
        <select
            aria-label="Filter by game"
            value={titleId}
            onchange={(event) => {
                titleId = event.currentTarget.value
                resetResults()
            }}
            class="order-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 sm:order-2 sm:w-52"
        >
            <option value="">All games</option>
            {#each titles as title (title.info.id)}
                <option value={title.info.id}>{title.info.metadata.name}</option>
            {/each}
        </select>
    </div>
    <div
        id="tournament-results"
        role="tabpanel"
        tabindex="0"
        aria-labelledby={`tournament-tab-${scope}`}
        aria-busy={busy}
        class="pt-5"
    >
        {#if error}<p role="alert" class="mb-4 text-sm text-red-600 dark:text-red-300">
                {error}
            </p>{/if}
        {#if !busy && !error && !tournaments.length}
            <div class="rounded-xl bg-gray-50 px-6 py-14 text-center dark:bg-gray-800/30">
                <p class="text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>
                {#if scope === 'mine'}<button
                        onclick={() => selectTab('open')}
                        class="mt-3 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                        >Explore open tournaments →</button
                    >{/if}
            </div>
        {/if}
        <div class="columns-1 gap-3 sm:columns-2">
            {#each tournaments as tournament (tournament.id)}
                {@const thumbnail = libraryService.getThumbnailForTitle(tournament.rules.titleId)}
                {@const options = gameCardOptions(
                    tournament.rules.gameConfig,
                    libraryService.getTitle(tournament.rules.titleId)?.info.configurator?.options ??
                        []
                )}
                <a
                    href={`/tournaments/${tournament.id}`}
                    class="mb-3 flex break-inside-avoid flex-col overflow-hidden rounded-md border-4 border-gray-200 bg-white p-3 shadow-none transition-colors hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 dark:border-gray-800 dark:bg-gray-800 dark:hover:border-blue-500/70"
                >
                    <div class="mb-2 flex items-center justify-between gap-3 text-xs">
                        <span
                            class="inline-flex items-center gap-1.5 {tournamentStatusColor(
                                tournament.status
                            )}"
                            ><span class="size-1.5 rounded-full bg-current"
                            ></span>{tournamentStatusText(tournament)}</span
                        >
                        <span class="text-gray-500 dark:text-gray-400"
                            >{tournament.entrants.length}{tournament.rules.registration.capacity
                                ? ` / ${tournament.rules.registration.capacity}`
                                : ''} joined</span
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
                                {tournament.name}
                            </h2>
                            <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <p
                                    class="font-tournament text-[calc(0.7rem+2px)] leading-[0.8rem] text-gray-600"
                                >
                                    {libraryService.getNameForTitle(tournament.rules.titleId)}
                                </p>
                                <span
                                    title={tournamentFormatText(tournament.format)}
                                    class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[0.6rem] leading-none text-gray-500 dark:bg-gray-700/60 dark:text-gray-400"
                                >
                                    {tournament.format.kind === 'mini' ? 'Mini' : 'Multi-stage'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <p class="mt-2 text-xs leading-4 text-gray-600 dark:text-gray-300">
                        <span class="font-medium">{tournament.rules.tableSize}</span> players per
                        game
                        <span class="mx-1 text-gray-400 dark:text-gray-600">·</span>
                        <span class="font-medium"
                            >{tournament.format.stages[0].gamesPerEntrant}</span
                        > games each
                    </p>
                    {#if options.length}
                        <div class="pt-2 flex flex-col text-xs text-gray-400">
                            <Hr class="mt-1 mb-1" />
                            <dl aria-label="Game options">
                                {#each options as option}
                                    <div class="flex justify-between gap-3">
                                        <dt>{option.name}</dt>
                                        <dd class="text-right">
                                            {option.value}
                                        </dd>
                                    </div>
                                {/each}
                            </dl>
                            <Hr class="mt-1 mb-1" />
                        </div>
                    {/if}
                    <p class="text-xs leading-4 text-gray-500 {options.length ? 'mt-1' : 'mt-2'}">
                        {tournamentRegistrationText(tournament)}
                    </p>
                </a>
            {/each}
        </div>
        {#if cursor}<button
                class="mt-5 rounded-full border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
                disabled={busy}
                onclick={() => refresh(cursor)}>Next page</button
            >{/if}
    </div>
</main>
