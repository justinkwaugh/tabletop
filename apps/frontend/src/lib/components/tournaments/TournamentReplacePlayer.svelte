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

    let { detail, onchanged }: { detail: TournamentDetail; onchanged: () => void } = $props()
    const { api } = getAppContext()
    let schedule = $state<TournamentSchedule>()
    let placeId = $state('')
    let mode = $state<'substitute' | 'withdraw'>('substitute')
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

    let matches = $state<string[]>([])
    let searchRequest = 0
    async function search() {
        const request = ++searchRequest
        const text = substitute.trim()
        const found = text.length > 1 ? await api.searchUsernames(text) : []
        if (request === searchRequest) matches = found.filter((value) => !taken.includes(value))
    }

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
            error = failure instanceof Error ? failure.message : 'Could not replace the player'
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
    aria-label="Replace a player"
>
    <h2 class="font-tournament text-lg font-semibold">Replace a player</h2>
    <p class="mt-1 text-xs text-gray-500">
        A substitute takes over the player's place and finishes their games. A withdrawn player's
        unfinished games don't count for anyone.
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
            >Player
            <Select
                size="sm"
                placeholder=""
                class="mt-1 w-fit"
                bind:value={placeId}
                onchange={() => (handovers = {})}
                disabled={busy}
                required
            >
                <option value="">Choose a player</option>
                {#each places as entrant (entrant.userId)}
                    <option value={entrant.userId}>{name(tournamentEntrantAccount(entrant))}</option
                    >
                {/each}
            </Select>
        </label>
        {#if place && finishing}
            <p class="text-xs text-gray-500">
                {name(playing)} was withdrawn, but {activeTables.length === 1
                    ? 'a game of theirs is'
                    : `${activeTables.length} games of theirs are`} still in progress. Finishing the withdrawal
                ends {activeTables.length === 1 ? 'it' : 'them'}.
            </p>
            <button
                class="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                disabled={busy}>Finish withdrawing {name(playing)}</button
            >
        {:else if place}
            <fieldset disabled={busy} class="flex gap-4 text-sm">
                <legend class="sr-only">Replace with</legend>
                <label class="flex items-center gap-2"
                    ><input type="radio" value="substitute" bind:group={mode} />Substitute</label
                >
                <label class="flex items-center gap-2"
                    ><input type="radio" value="withdraw" bind:group={mode} />Withdraw</label
                >
            </fieldset>
            {#if mode === 'substitute'}
                <label class="block text-xs" for="tournament-substitute">Substitute</label>
                <input
                    id="tournament-substitute"
                    class="block w-56 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                    list="tournament-substitute-matches"
                    autocomplete="off"
                    placeholder="Username"
                    bind:value={substitute}
                    oninput={() => void search()}
                    required
                    disabled={busy}
                />
                <datalist id="tournament-substitute-matches">
                    {#each matches as match (match)}<option value={match}></option>{/each}
                </datalist>
                {#if activeTables.length}
                    <fieldset disabled={busy} class="space-y-2">
                        <legend class="mb-1 text-xs text-gray-500">Games in progress</legend>
                        {#each activeTables as tableId (tableId)}
                            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                <span class="w-20 text-xs text-gray-500"
                                    >Table {Number(tableId)}</span
                                >
                                <label class="flex items-center gap-2"
                                    ><input
                                        type="radio"
                                        name={`handover-${tableId}`}
                                        checked={(handovers[tableId] ?? 'takeOver') === 'takeOver'}
                                        onchange={() =>
                                            (handovers = { ...handovers, [tableId]: 'takeOver' })}
                                    />Take over the game</label
                                >
                                <label class="flex items-center gap-2"
                                    ><input
                                        type="radio"
                                        name={`handover-${tableId}`}
                                        checked={handovers[tableId] === 'restart'}
                                        onchange={() =>
                                            (handovers = { ...handovers, [tableId]: 'restart' })}
                                    />Restart it</label
                                >
                            </div>
                        {/each}
                    </fieldset>
                {/if}
                <p class="text-xs text-gray-500">
                    {detail.tournament.league
                        ? `${name(playing)} is dropped. The substitute's place can't move up or down, and they start next season in the bottom level.`
                        : `${name(playing)} is dropped. The substitute's place can't win the tournament.`}
                </p>
            {:else}
                <p class="text-xs text-gray-500">
                    {name(playing)}'s unfinished games end and count for nobody. Their finished
                    results stay, and they won't be ranked{detail.tournament.league
                        ? ' or have a place next season'
                        : ''}.
                </p>
            {/if}
            <button
                class="rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 {mode ===
                'withdraw'
                    ? 'bg-red-600'
                    : 'bg-blue-600'}"
                disabled={busy || (mode === 'substitute' && !substitute.trim())}
                >{mode === 'withdraw' ? `Withdraw ${name(playing)}` : 'Substitute'}</button
            >
        {/if}
    </form>
</section>
