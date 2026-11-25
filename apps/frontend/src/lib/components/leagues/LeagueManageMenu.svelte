<script lang="ts">
    import {
        leagueSignUpDays,
        type League,
        type LeagueSeason,
        type LeagueSignUpOperation,
        type LeagueSignUpPolicy
    } from '@tabletop/common'
    import { localDateTimeInputValue } from '$lib/utils/dateTimeInput'
    import RichMessage from '$lib/components/RichMessage.svelte'
    import { m } from '$lib/paraglide/messages'

    let {
        league,
        season,
        busy,
        editingDraft,
        onedit,
        onschedule,
        onpreview,
        oncancel,
        onsignuppolicy
    }: {
        league: League
        season?: LeagueSeason
        busy: boolean
        editingDraft: boolean
        onedit: () => void
        onschedule: (operation: LeagueSignUpOperation, closesAt: number) => void
        onpreview: () => void
        oncancel: () => void
        onsignuppolicy: (policy: LeagueSignUpPolicy) => void
    } = $props()

    let open = $state(false)
    let closeAt = $state(localDateTimeInputValue(Date.now() + 7 * 86_400_000))
    let opensAutomatically = $derived(league.signUp.opensAutomatically)
    let signUpDays = $derived(league.signUp.days)
    let action = $derived.by(
        (): { operation: LeagueSignUpOperation; label: string } | undefined => {
            if (league.status === 'draft')
                return { operation: 'publish', label: m.leagues_manage_open_season({ number: 0 }) }
            if (season?.status === 'signUp')
                return { operation: 'signUp/close', label: m.leagues_manage_move_close() }
            if (season?.status === 'finished' || season?.status === 'cancelled')
                return {
                    operation: 'seasons/next',
                    label: m.leagues_manage_open_season({ number: season.number + 1 })
                }
            return undefined
        }
    )

    function run(callback: () => void) {
        open = false
        callback()
    }
</script>

{#snippet localTimeHint(text: string)}<span class="text-[10px]">{text}</span>{/snippet}
{#snippet signUpDaysInput()}<input
        type="number"
        min={leagueSignUpDays.minimum}
        max={leagueSignUpDays.maximum}
        class="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        bind:value={signUpDays}
    />{/snippet}

{#if league.status === 'draft' || league.status === 'active'}
    <details class="relative" bind:open>
        <summary class="manage-toggle"
            >{m.leagues_manage()}
            <svg
                aria-hidden="true"
                class="size-3 shrink-0"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                ><path d="m4 6 4 4 4-4" stroke-linecap="round" stroke-linejoin="round"></path></svg
            ></summary
        >
        <div
            class="absolute right-0 z-20 mt-1 w-72 rounded-md border border-gray-200 bg-white p-1 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
            {#if league.status === 'draft'}
                <button class="menu-item" disabled={busy} onclick={() => run(onedit)}
                    >{editingDraft
                        ? m.leagues_manage_close_editor()
                        : m.leagues_manage_edit_draft()}</button
                >
            {/if}
            {#if action}
                <div class="menu-section">
                    <label class="flex flex-col gap-1 text-gray-500 dark:text-gray-400">
                        <RichMessage
                            parts={m.leagues_manage_sign_up_closes.parts()}
                            markup={{ hint: localTimeHint }}
                        />
                        <input
                            type="datetime-local"
                            class="rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                            bind:value={closeAt}
                        />
                    </label>
                    <button
                        class="mt-2 w-full rounded bg-blue-600 px-2 py-1.5 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                        disabled={busy || editingDraft}
                        onclick={() =>
                            run(() => onschedule(action.operation, new Date(closeAt).getTime()))}
                        >{action.label}</button
                    >
                </div>
            {/if}
            {#if season?.status === 'signUp'}
                <button class="menu-item" disabled={busy} onclick={() => run(onpreview)}
                    >{m.leagues_manage_preview_groups()}</button
                >
                <button
                    class="menu-item text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
                    disabled={busy}
                    onclick={() =>
                        run(() => {
                            if (
                                confirm(
                                    m.leagues_manage_cancel_season_confirm({
                                        number: season.number
                                    })
                                )
                            )
                                oncancel()
                        })}>{m.leagues_manage_cancel_season()}</button
                >
            {/if}
            {#if league.status === 'active'}
                <div class="menu-section">
                    <p class="mb-1.5 font-medium">{m.leagues_between_seasons()}</p>
                    <label class="flex items-center gap-2">
                        <input type="checkbox" bind:checked={opensAutomatically} />
                        {m.leagues_opens_automatically()}
                    </label>
                    <label class="mt-2 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <RichMessage
                            parts={m.leagues_manage_sign_up_lasts.parts()}
                            markup={{ days: signUpDaysInput }}
                        />
                    </label>
                    <button
                        class="mt-2 w-full rounded border border-gray-400 px-2 py-1.5 hover:border-gray-300 disabled:opacity-50"
                        disabled={busy ||
                            (opensAutomatically === league.signUp.opensAutomatically &&
                                signUpDays === league.signUp.days)}
                        onclick={() =>
                            run(() => onsignuppolicy({ opensAutomatically, days: signUpDays }))}
                        >{m.leagues_manage_save()}</button
                    >
                </div>
            {/if}
        </div>
    </details>
{/if}

<style>
    .manage-toggle {
        display: inline-flex;
        cursor: pointer;
        list-style: none;
        align-items: center;
        gap: 0.375rem;
        border: 1px solid var(--color-gray-500);
        border-radius: 0.375rem;
        padding: 0.375rem 0.625rem;
        font-size: 0.75rem;
        line-height: 1rem;
    }
    .manage-toggle:hover {
        border-color: var(--color-gray-400);
    }
    .menu-section {
        border-top: 1px solid var(--color-gray-200);
        padding: 0.5rem;
    }
    .menu-section:first-child {
        border-top: 0;
    }
    :global(.dark) .menu-section {
        border-color: var(--color-gray-700);
    }
    .menu-item {
        display: block;
        width: 100%;
        border-radius: 0.25rem;
        padding: 0.375rem 0.5rem;
        text-align: left;
    }
    .menu-item:hover:not(:disabled) {
        background: var(--color-gray-100);
    }
    :global(.dark) .menu-item:hover:not(:disabled) {
        background: var(--color-gray-700);
    }
    .menu-item:disabled {
        opacity: 0.5;
    }
</style>
