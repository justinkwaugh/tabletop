<script lang="ts">
    import { Select } from 'flowbite-svelte'
    import { onMount } from 'svelte'
    import {
        tournamentAccountIds,
        tournamentActiveTables,
        tournamentEntrantAccount,
        type TournamentDetail,
        type TournamentSchedule,
        type TournamentTableHandover
    } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { accountName } from '$lib/utils/accountName'
    import { UsernameSuggestions } from '$lib/utils/usernameSuggestions.svelte'
    import { m } from '$lib/paraglide/messages'

    let { detail, onchanged }: { detail: TournamentDetail; onchanged: () => void } = $props()
    const { api } = getAppContext()
    let schedule = $state<TournamentSchedule>()
    let placeId = $state('')
    // A Knockout place takes no Substitute: a withdrawal forfeits the Match.
    let knockout = $derived(detail.tournament.format.kind === 'knockout')
    let chosenMode = $state<'substitute' | 'withdraw'>('substitute')
    let mode = $derived(knockout ? 'withdraw' : chosenMode)
    let substitute = $state('')
    let handovers = $state<Record<string, TournamentTableHandover>>({})
    let busy = $state(false)
    let error = $state('')

    const tablesOf = (entrantId: string) =>
        tournamentActiveTables(detail.tournament, schedule?.tables ?? [], entrantId)
    // A withdrawn player stays listed while a Game of theirs is still in progress, so an
    // interrupted withdrawal can be finished.
    let places = $derived(
        detail.tournament.entrants.filter(
            (entrant) => !entrant.withdrawn || tablesOf(entrant.userId).length > 0
        )
    )
    let place = $derived(places.find((entrant) => entrant.userId === placeId))
    let playing = $derived(place ? tournamentEntrantAccount(place) : '')
    let activeTables = $derived(place ? tablesOf(place.userId) : [])
    let finishing = $derived(!!place?.withdrawn)
    let taken = $derived(
        tournamentAccountIds(detail.tournament).map((id) => detail.usernames[id] ?? '')
    )

    const suggestions = new UsernameSuggestions((text) => api.searchUsernames(text))

    function name(userId: string) {
        return accountName(detail.usernames, userId)
    }

    async function save() {
        if (!place) return
        busy = true
        error = ''
        try {
            if (mode === 'withdraw' || finishing)
                await api.withdrawTournamentEntrant(detail.tournament.id, {
                    revision: detail.tournament.revision,
                    userId: playing
                })
            else
                await api.substituteTournamentEntrant(detail.tournament.id, {
                    revision: detail.tournament.revision,
                    userId: playing,
                    substituteUsername: substitute,
                    tables: handovers
                })
            placeId = ''
            substitute = ''
            handovers = {}
            onchanged()
        } catch (failure) {
            error = failure instanceof Error ? failure.message : m.tournaments_replace_failed()
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
    aria-label={m.tournaments_replace_heading()}
>
    <h2 class="font-tournament text-lg font-semibold">{m.tournaments_replace_heading()}</h2>
    <p class="mt-1 text-xs text-gray-500">
        {#if knockout}
            {m.tournaments_replace_knockout_intro()}
        {:else}
            {m.tournaments_replace_intro()}
        {/if}
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
            >{m.tournaments_replace_player()}
            <Select
                size="sm"
                placeholder=""
                class="mt-1 w-fit"
                bind:value={placeId}
                onchange={() => (handovers = {})}
                disabled={busy}
                required
            >
                <option value="">{m.tournaments_replace_choose_player()}</option>
                {#each places as entrant (entrant.userId)}
                    <option value={entrant.userId}>{name(tournamentEntrantAccount(entrant))}</option
                    >
                {/each}
            </Select>
        </label>
        {#if place && finishing}
            <p class="text-xs text-gray-500">
                {m.tournaments_replace_withdrawn_in_progress({
                    name: name(playing),
                    count: activeTables.length
                })}
            </p>
            <button
                class="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                disabled={busy}
                >{m.tournaments_replace_finish_withdrawing({ name: name(playing) })}</button
            >
        {:else if place}
            {#if !knockout}
                <fieldset disabled={busy} class="flex gap-4 text-sm">
                    <legend class="sr-only">{m.tournaments_replace_with()}</legend>
                    <label class="flex items-center gap-2"
                        ><input
                            type="radio"
                            value="substitute"
                            bind:group={chosenMode}
                        />{m.tournaments_replace_substitute()}</label
                    >
                    <label class="flex items-center gap-2"
                        ><input
                            type="radio"
                            value="withdraw"
                            bind:group={chosenMode}
                        />{m.tournaments_replace_withdraw()}</label
                    >
                </fieldset>
            {/if}
            {#if mode === 'substitute'}
                <label class="block text-xs" for="tournament-substitute"
                    >{m.tournaments_replace_substitute()}</label
                >
                <input
                    id="tournament-substitute"
                    class="block w-56 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                    list="tournament-substitute-matches"
                    autocomplete="off"
                    placeholder={m.tournaments_replace_username_placeholder()}
                    bind:value={substitute}
                    oninput={() => void suggestions.suggest(substitute, taken)}
                    required
                    disabled={busy}
                />
                <datalist id="tournament-substitute-matches">
                    {#each suggestions.matches as match (match)}<option value={match}
                        ></option>{/each}
                </datalist>
                {#if activeTables.length}
                    <fieldset disabled={busy} class="space-y-2">
                        <legend class="mb-1 text-xs text-gray-500"
                            >{m.tournaments_replace_games_in_progress()}</legend
                        >
                        {#each activeTables as tableId (tableId)}
                            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                <span class="w-20 text-xs text-gray-500"
                                    >{m.tournaments_table_number({
                                        table: Number(tableId)
                                    })}</span
                                >
                                <label class="flex items-center gap-2"
                                    ><input
                                        type="radio"
                                        name={`handover-${tableId}`}
                                        checked={(handovers[tableId] ?? 'takeOver') === 'takeOver'}
                                        onchange={() =>
                                            (handovers = { ...handovers, [tableId]: 'takeOver' })}
                                    />{m.tournaments_replace_take_over()}</label
                                >
                                <label class="flex items-center gap-2"
                                    ><input
                                        type="radio"
                                        name={`handover-${tableId}`}
                                        checked={handovers[tableId] === 'restart'}
                                        onchange={() =>
                                            (handovers = { ...handovers, [tableId]: 'restart' })}
                                    />{m.tournaments_replace_restart()}</label
                                >
                            </div>
                        {/each}
                    </fieldset>
                {/if}
                <p class="text-xs text-gray-500">
                    {detail.tournament.league
                        ? m.tournaments_replace_dropped_league({ name: name(playing) })
                        : m.tournaments_replace_dropped({ name: name(playing) })}
                </p>
            {:else if knockout}
                <p class="text-xs text-gray-500">
                    {m.tournaments_replace_knockout_withdraw_note({ name: name(playing) })}
                </p>
            {:else}
                <p class="text-xs text-gray-500">
                    {detail.tournament.league
                        ? m.tournaments_replace_withdraw_note_league({ name: name(playing) })
                        : m.tournaments_replace_withdraw_note({ name: name(playing) })}
                </p>
            {/if}
            <button
                class="rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 {mode ===
                'withdraw'
                    ? 'bg-red-600'
                    : 'bg-blue-600'}"
                disabled={busy || (mode === 'substitute' && !substitute.trim())}
                >{mode === 'withdraw'
                    ? m.tournaments_replace_withdraw_action({ name: name(playing) })
                    : m.tournaments_replace_substitute_action()}</button
            >
        {/if}
    </form>
</section>
