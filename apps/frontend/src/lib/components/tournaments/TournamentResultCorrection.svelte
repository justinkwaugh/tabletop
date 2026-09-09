<script lang="ts">
    import { Select } from 'flowbite-svelte'
    import { onMount } from 'svelte'
    import type { TournamentDetail, TournamentSchedule } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    let { detail, onchanged }: { detail: TournamentDetail; onchanged: () => void } = $props()
    const { api } = getAppContext()
    let schedule = $state<TournamentSchedule>()
    let tableId = $state('')
    let winners = $state<string[]>([])
    let reason = $state('')
    let busy = $state(false)
    let error = $state('')
    let table = $derived(schedule?.tables.find((table) => table.id === tableId))
    let finished = $derived(detail.tournament.stages[0]?.dispatch?.finished ?? [])

    function selectTable() {
        winners = [
            ...(detail.games?.find((game) => game.tableId === tableId)?.winningUserIds ?? [])
        ]
        reason = ''
    }
    async function save() {
        busy = true
        error = ''
        try {
            await api.correctTournamentResult(detail.tournament.id, {
                revision: detail.tournament.revision,
                tableId,
                winningUserIds: winners,
                reason
            })
            reason = ''
            onchanged()
        } catch (failure) {
            error = failure instanceof Error ? failure.message : 'Could not correct result'
        } finally {
            busy = false
        }
    }
    onMount(() => {
        void api
            .getTournamentSchedule(detail.tournament.id)
            .then((value) => (schedule = value))
            .catch(
                (failure) =>
                    (error = failure instanceof Error ? failure.message : 'Could not load tables')
            )
    })
</script>

<section
    class="mt-4 max-w-xl rounded-md border border-gray-200 p-3 dark:border-gray-700"
    aria-label="Correct tournament credit"
>
    <h2 class="font-tournament text-lg font-semibold">Correct tournament credit</h2>
    <p class="mt-1 text-xs text-gray-500">
        Choose the credited winners. The played game and its history stay unchanged.
    </p>
    {#if error}<p role="alert" class="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>{/if}
    <form
        class="mt-3 space-y-3"
        onsubmit={(event) => {
            event.preventDefault()
            void save()
        }}
    >
        <label class="block text-xs"
            >Table
            <Select
                size="sm"
                placeholder=""
                class="mt-1 w-fit"
                bind:value={tableId}
                onchange={selectTable}
                disabled={busy}
                required
            >
                <option value="">Choose a finished table</option>
                {#each schedule?.tables.filter( (table) => finished.includes(table.id) ) ?? [] as table}
                    <option value={table.id}>Table {table.id}</option>
                {/each}
            </Select>
        </label>
        {#if table}
            <fieldset disabled={busy} class="space-y-2">
                <legend class="mb-2 text-xs text-gray-500"
                    >Credited winners — choose one or more</legend
                >
                {#each table.entrantIds as id}
                    <label class="flex items-center gap-2 text-sm"
                        ><input type="checkbox" value={id} bind:group={winners} />{detail.usernames[
                            id
                        ] ?? 'Unavailable account'}</label
                    >
                {/each}
            </fieldset>
            <label class="block text-xs"
                >Reason
                <textarea
                    class="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                    bind:value={reason}
                    maxlength="1000"
                    rows="2"
                    required
                    disabled={busy}
                ></textarea>
            </label>
            <button
                class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                disabled={busy || !reason.trim() || !winners.length}>Save correction</button
            >
        {/if}
    </form>
</section>
