<script lang="ts">
    import { onMount } from 'svelte'
    import { Role, type TournamentDetail } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { listenForTournamentChanges } from '$lib/services/tournamentUpdates'
    import { tournamentApi } from '$lib/services/tournamentApi'
    import {
        tournamentFormatText,
        tournamentRegistrationText,
        tournamentStatusText
    } from '$lib/utils/tournamentPresentation'
    import TournamentForm from './TournamentForm.svelte'
    import TournamentGameOptions from './TournamentGameOptions.svelte'

    let { id }: { id: string } = $props()
    const { authorizationService, libraryService, notificationService } = getAppContext()
    let user = $derived(authorizationService.getSessionUser())
    let isAdmin = $derived(user?.roles.includes(Role.Admin))
    let detail = $state<TournamentDetail>()
    let tournament = $derived(detail?.tournament)
    let title = $derived(
        tournament ? libraryService.titlesById[tournament.rules.titleId] : undefined
    )
    let joined = $derived(detail?.entrants.some((entrant) => entrant.userId === user?.id))
    let full = $derived(
        tournament
            ? tournament.entrantCount >= (tournament.rules.registration.capacity ?? 256)
            : false
    )
    let editingDraft = $state(false)
    let error = $state('')
    let busy = $state(false)
    let request = 0

    async function refresh() {
        const current = ++request
        try {
            const value = await tournamentApi.get(id)
            if (current === request) detail = value
        } catch (failure) {
            if (current === request)
                error = failure instanceof Error ? failure.message : 'Could not load tournament'
        }
    }
    async function act(operation: 'join' | 'leave' | 'publish' | 'cancel' | 'lock') {
        if (!tournament) return
        busy = true
        error = ''
        try {
            if (operation === 'join') await tournamentApi.join(tournament)
            else await tournamentApi.act(id, operation)
        } catch (failure) {
            error = failure instanceof Error ? failure.message : 'Could not update tournament'
        } finally {
            await refresh()
            busy = false
        }
    }
    onMount(() => {
        const unsubscribe = listenForTournamentChanges(notificationService, refresh, id)
        void refresh()
        return () => {
            request++
            unsubscribe()
        }
    })
</script>

<svelte:head><title>{tournament?.name ?? 'Tournament'} · Tabletop</title></svelte:head>
<main
    class="mx-auto max-w-6xl px-4 pb-10 pt-4 text-gray-900 dark:text-gray-100 sm:px-6 sm:pt-5"
    aria-busy={!detail && !error}
>
    <a
        class="text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
        href="/tournaments">← Tournaments</a
    >
    {#if error}<p role="alert" class="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>{/if}
    {#if tournament && detail}
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
                            {tournament.name}
                        </h1>
                        <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                {title?.info.metadata.name ?? tournament.rules.titleId}
                            </p>
                            <span
                                title={tournamentFormatText(tournament.format)}
                                class="rounded bg-gray-100 px-1.5 py-0.5 text-[0.6rem] leading-none text-gray-500 dark:bg-gray-700/60 dark:text-gray-400"
                                >{tournament.format.kind === 'mini' ? 'Mini' : 'Multi-stage'}</span
                            >
                        </div>
                        <p
                            class="mt-1.5 inline-flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300"
                        >
                            <span class="size-1.5 rounded-full bg-current" aria-hidden="true"
                            ></span>
                            {tournamentStatusText(tournament)}
                        </p>
                    </div>
                </div>
                <div class="flex shrink-0 flex-wrap items-center gap-2">
                    {#if tournament.status === 'open' && !joined}
                        <button
                            class="primary-action"
                            disabled={busy || full}
                            onclick={() => act('join')}
                            >{full ? 'Registration full' : 'Join tournament'}</button
                        >
                    {/if}
                    {#if isAdmin && tournament.status === 'draft'}
                        <button
                            class="secondary-action"
                            disabled={busy}
                            onclick={() => (editingDraft = !editingDraft)}
                            >{editingDraft ? 'Close editor' : 'Edit draft'}</button
                        >
                        <button
                            class="primary-action"
                            disabled={busy || editingDraft}
                            onclick={() => act('publish')}>Open registration</button
                        >
                    {/if}
                    {#if isAdmin && tournament.status !== 'cancelled' && tournament.status !== 'inProgress'}
                        <details class="relative">
                            <summary class="secondary-action cursor-pointer list-none"
                                >Manage <svg
                                    aria-hidden="true"
                                    class="size-3 shrink-0"
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
                                class="absolute right-0 z-10 mt-1 w-40 rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                            >
                                <button
                                    class="w-full rounded px-2 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/30"
                                    disabled={busy}
                                    onclick={() => act('cancel')}>Cancel tournament</button
                                >
                            </div>
                        </details>
                    {/if}
                </div>
            </div>
            {#if tournament.description}<p
                    class="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-400"
                >
                    {tournament.description}
                </p>{/if}
            <p class="mt-3 text-xs text-gray-500">
                {#if tournament.status === 'open' || tournament.status === 'draft'}
                    {tournamentRegistrationText(tournament)}
                {:else if tournament.status === 'locked'}
                    Waiting for games to be scheduled.
                {/if}
            </p>
        </header>
        {#if isAdmin && tournament.status === 'draft' && editingDraft}
            <section
                aria-label="Edit tournament draft"
                class="mt-4 max-w-2xl rounded-md border border-gray-200 p-4 dark:border-gray-700"
            >
                {#key tournament.revision}
                    <TournamentForm
                        {tournament}
                        disabled={busy}
                        onsaved={() => {
                            editingDraft = false
                            void refresh()
                        }}
                    />
                {/key}
            </section>
        {/if}
        <div class="mt-5 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_18rem]">
            <section aria-labelledby="entrants-heading" class="min-w-0">
                <div class="mb-2 flex items-baseline justify-between gap-3">
                    <h2 id="entrants-heading" class="text-sm font-medium">
                        Players <span class="ml-1 text-gray-500"
                            >{tournament.entrantCount}{tournament.rules.registration.capacity
                                ? ` / ${tournament.rules.registration.capacity}`
                                : ''}</span
                        >
                    </h2>
                    {#if tournament.status === 'open' && !detail.entrants.length}<span
                            class="text-xs text-gray-500">Be the first to join</span
                        >{/if}
                </div>
                {#if detail.entrants.length}
                    <ul class="rounded-md bg-gray-50 px-3 py-1 dark:bg-gray-800">
                        {#each detail.entrants as entrant (entrant.userId)}
                            <li class="flex min-w-0 items-center gap-2 py-2 text-sm">
                                <div class="flex min-w-0 flex-1 items-center gap-2">
                                    <span
                                        class="truncate"
                                        title={entrant.username ?? 'Unavailable account'}
                                    >
                                        {entrant.username ?? 'Unavailable account'}
                                    </span>
                                    {#if entrant.userId === user?.id}<span
                                            class="shrink-0 rounded bg-gray-200 px-1 text-[0.6rem] text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                                            >You</span
                                        >{/if}
                                </div>
                                {#if entrant.userId === user?.id && tournament.status === 'open'}
                                    <button
                                        class="leave-action shrink-0"
                                        disabled={busy}
                                        onclick={() => act('leave')}>Leave</button
                                    >
                                {/if}
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <p
                        class="rounded-md bg-gray-50 px-3 py-5 text-xs text-gray-500 dark:bg-gray-800"
                    >
                        No players yet.
                    </p>
                {/if}
            </section>
            <aside class="space-y-4 rounded-md bg-gray-50 p-3 dark:bg-gray-800">
                <section aria-labelledby="format-heading">
                    <h2 id="format-heading" class="mb-2 text-sm font-medium">Tournament</h2>
                    <dl class="space-y-1.5 text-xs">
                        <div class="flex justify-between gap-3">
                            <dt class="text-gray-500 dark:text-gray-400">Players per game</dt>
                            <dd>{tournament.rules.tableSize}</dd>
                        </div>
                        <div class="flex justify-between gap-3">
                            <dt class="text-gray-500 dark:text-gray-400">Total games per player</dt>
                            <dd>{tournament.format.stages[0].gamesPerEntrant}</dd>
                        </div>
                        <div class="flex justify-between gap-3">
                            <dt class="text-gray-500 dark:text-gray-400">
                                Simultaneous games per player
                            </dt>
                            <dd>{tournament.rules.concurrency}</dd>
                        </div>
                        {#if tournament.format.kind === 'multiStage'}<div
                                class="flex justify-between gap-3"
                            >
                                <dt class="text-gray-500 dark:text-gray-400">Stages</dt>
                                <dd>{tournament.format.stages.length}</dd>
                            </div>{/if}
                    </dl>
                </section>
                <TournamentGameOptions
                    config={tournament.rules.gameConfig}
                    definitions={title?.info.configurator?.options}
                />
                <section
                    class="border-t border-gray-200 pt-3 dark:border-gray-700/60"
                    aria-labelledby="scoring-heading"
                >
                    <h2 id="scoring-heading" class="mb-1 text-sm font-medium">Scoring</h2>
                    <p class="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                        A win earns 1 point; joint winners split it. Starting positions are balanced
                        across your games.
                    </p>
                </section>
            </aside>
        </div>
    {/if}
</main>

<style>
    .primary-action,
    .secondary-action,
    .leave-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        border-radius: 0.375rem;
        padding: 0.375rem 0.625rem;
        font-size: 0.75rem;
        line-height: 1rem;
        white-space: nowrap;
    }
    .primary-action {
        background: var(--color-blue-600);
        color: white;
    }
    .primary-action:hover {
        background: var(--color-blue-500);
    }
    .secondary-action {
        border: 1px solid var(--color-gray-500);
        color: inherit;
    }
    .secondary-action:hover {
        border-color: var(--color-gray-400);
    }
    .leave-action {
        border: 1px solid var(--color-red-500);
        color: var(--color-red-500);
    }
    .leave-action:hover {
        background: var(--color-red-500);
        color: white;
    }
    .primary-action:focus-visible,
    .secondary-action:focus-visible,
    .leave-action:focus-visible {
        outline: 2px solid var(--color-blue-400);
        outline-offset: 2px;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>
