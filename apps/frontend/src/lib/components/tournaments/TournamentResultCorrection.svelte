<script lang="ts">
    import { Select } from 'flowbite-svelte'
    import { onMount } from 'svelte'
    import {
        ranksByAveragePlace,
        type TournamentDetail,
        type TournamentSchedule
    } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { placementCorrection, standingsPlaces } from '$lib/utils/tournamentFinishingPlaces'
    import { m } from '$lib/paraglide/messages'
    import { accountName } from '$lib/utils/accountName'

    let { detail, onchanged }: { detail: TournamentDetail; onchanged: () => void } = $props()
    const { api } = getAppContext()
    let schedule = $state<TournamentSchedule>()
    let tableId = $state('')
    let winners = $state<string[]>([])
    let places = $state<Record<string, number>>({})
    let reason = $state('')
    let busy = $state(false)
    let error = $state('')
    let table = $derived(schedule?.tables.find((table) => table.id === tableId))
    // Links cached before Games recorded their seats have no accounts; the backend also accepts
    // the place keys the Schedule lists and credits whichever account of each place played.
    let seated = $derived(
        detail.games?.find((game) => game.tableId === tableId)?.userIds ?? table?.entrantIds ?? []
    )
    let finished = $derived(detail.tournament.stages[0]?.dispatch?.finished ?? [])
    let ranksByPlace = $derived(ranksByAveragePlace(detail.tournament.rules))
    let placed = $derived(seated.every((id) => places[id] !== undefined))

    function selectTable() {
        const game = detail.games?.find((game) => game.tableId === tableId)
        winners = [...(game?.winningUserIds ?? [])]
        places = game?.finishingPlaces ? standingsPlaces(game.finishingPlaces) : {}
        reason = ''
    }

    function choosePlace(id: string, value: string) {
        if (value) places[id] = Number(value)
        else delete places[id]
    }
    async function save() {
        busy = true
        error = ''
        try {
            await api.correctTournamentResult(detail.tournament.id, {
                revision: detail.tournament.revision,
                tableId,
                winningUserIds: winners,
                ...(ranksByPlace ? placementCorrection(places) : {}),
                reason
            })
            reason = ''
            onchanged()
        } catch (failure) {
            error = failure instanceof Error ? failure.message : m.tournaments_correction_failed()
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
                    (error =
                        failure instanceof Error
                            ? failure.message
                            : m.tournaments_tables_load_failed())
            )
    })
</script>

<section
    class="mt-4 max-w-xl rounded-md border border-gray-200 p-3 dark:border-gray-700"
    aria-label={m.tournaments_correction_heading()}
>
    <h2 class="font-tournament text-lg font-semibold">{m.tournaments_correction_heading()}</h2>
    <p class="mt-1 text-xs text-gray-500">
        {ranksByPlace
            ? m.tournaments_correction_places_intro()
            : m.tournaments_correction_winners_intro()}
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
            >{m.tournaments_table()}
            <Select
                size="sm"
                placeholder=""
                class="mt-1 w-fit"
                bind:value={tableId}
                onchange={selectTable}
                disabled={busy}
                required
            >
                <option value="">{m.tournaments_correction_choose_table()}</option>
                {#each schedule?.tables.filter( (table) => finished.includes(table.id) ) ?? [] as table (table.id)}
                    <option value={table.id}
                        >{m.tournaments_table_number({ table: table.id })}</option
                    >
                {/each}
            </Select>
        </label>
        {#if table && ranksByPlace}
            <fieldset disabled={busy} class="space-y-2">
                <legend class="mb-2 text-xs text-gray-500"
                    >{m.tournaments_correction_places_legend()}</legend
                >
                {#each seated as id, entrantIndex (entrantIndex)}
                    <label class="flex items-center gap-2 text-sm"
                        ><Select
                            size="sm"
                            placeholder=""
                            class="w-16"
                            bind:value={
                                () => String(places[id] ?? ''), (value) => choosePlace(id, value)
                            }
                            required
                        >
                            <option value="">–</option>
                            {#each seated as _, place (place)}
                                <option value={String(place + 1)}>{place + 1}</option>
                            {/each}
                        </Select>{accountName(detail.usernames, id)}</label
                    >
                {/each}
            </fieldset>
        {:else if table}
            <fieldset disabled={busy} class="space-y-2">
                <legend class="mb-2 text-xs text-gray-500"
                    >{m.tournaments_correction_winners_legend()}</legend
                >
                {#each seated as id, entrantIndex (entrantIndex)}
                    <label class="flex items-center gap-2 text-sm"
                        ><input type="checkbox" value={id} bind:group={winners} />{accountName(
                            detail.usernames,
                            id
                        )}</label
                    >
                {/each}
            </fieldset>
        {/if}
        {#if table}
            <label class="block text-xs"
                >{m.tournaments_correction_reason()}
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
                disabled={busy || !reason.trim() || (ranksByPlace ? !placed : !winners.length)}
                >{m.tournaments_correction_save()}</button
            >
        {/if}
    </form>
</section>
