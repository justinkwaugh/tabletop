<script lang="ts">
    import {
        Input,
        Textarea,
        Label,
        Toggle,
        Button,
        ButtonGroup,
        RadioButton,
        Helper,
        Hr
    } from 'flowbite-svelte'
    import TournamentSelect from './TournamentSelect.svelte'
    import GameConfigFields from './GameConfigFields.svelte'
    import { localDateTimeInputValue } from '$lib/utils/dateTimeInput'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import {
        range,
        getMiniTournamentDefaults,
        miniTournamentDefaults,
        tournamentCapacity,
        type Tournament,
        type TournamentDraft
    } from '@tabletop/common'
    import { onMount, untrack } from 'svelte'
    import { CompetitionGameChoice } from './competitionGameChoice.svelte'
    import { nanoid } from 'nanoid'

    let {
        tournament,
        onsaved,
        oncancel,
        disabled = false
    }: {
        tournament?: Tournament
        onsaved: (tournament: Tournament) => void
        oncancel: () => void
        disabled?: boolean
    } = $props()
    const { api, libraryService } = getAppContext()
    const initial = untrack(() => tournament)
    const id = initial?.id ?? nanoid()
    let name = $state(initial?.name ?? '')
    let description = $state(initial?.description ?? '')
    let tableSize = $state(initial?.rules.tableSize ?? 4)
    let registrationKind = $state<'whenFull' | 'deadline'>(
        initial?.rules.registration.kind === 'deadline' ? 'deadline' : 'whenFull'
    )
    let minimumEntrants = $state(
        initial?.rules.registration.kind === 'deadline'
            ? initial.rules.registration.minimumEntrants
            : miniTournamentDefaults[4].capacity
    )
    let capacity = $state(
        (initial && tournamentCapacity(initial.rules.registration)) ??
            miniTournamentDefaults[4].capacity
    )
    let capped = $state(
        initial !== undefined && tournamentCapacity(initial.rules.registration) !== undefined
    )
    let gamesPerEntrant = $state(
        initial?.format.stages[0].gamesPerEntrant ?? miniTournamentDefaults[4].gamesPerEntrant
    )
    let concurrency = $state(
        initial?.rules.concurrency ?? miniTournamentDefaults[4].gamesPerEntrant
    )
    let deadline = $state(
        localDateTimeInputValue(
            initial?.rules.registration.kind === 'deadline'
                ? initial.rules.registration.closesAt
                : Date.now() + 7 * 86_400_000
        )
    )
    let busy = $state(false)
    let error = $state('')

    const game = new CompetitionGameChoice(
        libraryService,
        initial?.rules.titleId,
        initial?.rules.gameConfig
    )
    let title = $derived(game.title)
    let config = $derived(game.config)

    onMount(() =>
        game.loadEligibleTitles(api, 'Could not load the games available for tournaments.')
    )

    function selectTitle(selectedTitleId: string) {
        const selected = game.select(selectedTitleId)
        if (selected) setTableSize(selected.info.metadata.defaultPlayerCount)
    }

    function setTableSize(value: number) {
        tableSize = value
        const defaults = getMiniTournamentDefaults(tableSize)
        if (defaults) {
            capacity = defaults.capacity
            minimumEntrants = defaults.capacity
        }
        gamesPerEntrant = defaults?.gamesPerEntrant ?? tableSize
        concurrency = gamesPerEntrant
    }

    function updateGamesPerEntrant(value: number) {
        concurrency = concurrency === gamesPerEntrant ? value : Math.min(concurrency, value)
        gamesPerEntrant = value
    }

    async function save() {
        busy = true
        error = ''
        try {
            const registration =
                registrationKind === 'whenFull'
                    ? { kind: registrationKind, capacity }
                    : {
                          kind: registrationKind,
                          minimumEntrants,
                          closesAt: new Date(deadline).getTime(),
                          ...(capped ? { capacity } : {})
                      }
            const draft: TournamentDraft = {
                name,
                description,
                format: {
                    kind: 'mini',
                    stages: [
                        {
                            id: tournament?.format.stages[0].id ?? '1',
                            name: 'Main stage',
                            gamesPerEntrant
                        }
                    ]
                },
                rules: {
                    titleId: game.titleId,
                    tableSize,
                    registration,
                    concurrency,
                    gameConfig: config,
                    scoring: 'splitWinsV1'
                }
            }
            const saved = tournament
                ? await api.updateTournament(tournament, draft)
                : await api.createTournament(id, draft)
            onsaved(saved)
        } catch (failure) {
            error = failure instanceof Error ? failure.message : 'Could not save the tournament'
        } finally {
            busy = false
        }
    }
</script>

<div class="mb-5 flex items-center gap-3">
    <h1 class="font-tournament text-2xl font-semibold text-gray-900 dark:text-gray-200">
        {tournament ? 'Edit tournament' : 'Create tournament'}
    </h1>
    <span
        class="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-500 dark:border-gray-600 dark:text-gray-400"
        >Mini</span
    >
</div>
<form
    onsubmit={(event) => {
        event.preventDefault()
        void save()
    }}
    class="text-left"
>
    <fieldset disabled={disabled || busy} class="space-y-4 disabled:opacity-60">
        <div>
            <Label for="tournament-name" class="mb-2">Name</Label>
            <Input
                id="tournament-name"
                bind:value={name}
                placeholder="Choose a name for your tournament"
                required
                maxlength={120}
            />
        </div>
        <div>
            <Label for="tournament-game" class="mb-2">Game</Label>
            <TournamentSelect
                id="tournament-game"
                value={game.titleId}
                placeholder="Choose a game"
                options={game.titles.map((item) => ({
                    value: item.info.id,
                    name: item.info.metadata.name
                }))}
                onchange={selectTitle}
            />
            {#if game.titlesError}<Helper color="red" class="mt-1">{game.titlesError}</Helper
                >{:else if libraryService.loading || !game.eligibleTitleIds}<Helper class="mt-1"
                    >Loading game titles…</Helper
                >{:else if !game.titles.length}<Helper color="red" class="mt-1"
                    >Game titles are unavailable.</Helper
                >{/if}
        </div>
        {#if title}
            <div>
                <Label class="mb-2">Players per game</Label>
                <ButtonGroup aria-label="Players per game">
                    {#each range(title.info.metadata.minPlayers, title.info.metadata.maxPlayers - title.info.metadata.minPlayers + 1) as count (count)}
                        <RadioButton
                            value={count}
                            bind:group={tableSize}
                            onchange={() => setTableSize(count)}
                            checkedClass="dark:hover:bg-transparent dark:bg-transparent dark:text-primary-500 dark:hover:text-primary-500 dark:focus-within:text-primary-500"
                            >{count}</RadioButton
                        >
                    {/each}
                </ButtonGroup>
            </div>
        {/if}
        {#if title?.info.configurator?.options.length}
            <Hr class="my-4" />
            <GameConfigFields
                options={title.info.configurator.options}
                {config}
                onupdate={(option, value) => game.updateOption(option, value)}
            />
        {/if}
        <Hr class="my-4" />
        <div>
            <Label for="tournament-registration" class="mb-2">Registration closes</Label>
            <TournamentSelect
                id="tournament-registration"
                value={registrationKind}
                options={[
                    { value: 'whenFull', name: 'When the tournament fills' },
                    { value: 'deadline', name: 'On a specified date' }
                ] as const}
                onchange={(value) => (registrationKind = value)}
            />
        </div>
        {#if registrationKind === 'deadline'}
            <div>
                <Label for="tournament-deadline" class="mb-2">Closing date</Label>
                <Input
                    id="tournament-deadline"
                    type="datetime-local"
                    bind:value={deadline}
                    required
                />
                <Helper class="mt-1 text-xs">Uses your local time.</Helper>
            </div>
        {/if}
        <details>
            <summary class="cursor-pointer text-sm text-gray-500 dark:text-gray-400"
                >Advanced</summary
            >
            <div class="mt-4 space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <Label for="tournament-games" class="mb-2">Total games per player</Label>
                        <Input
                            id="tournament-games"
                            type="number"
                            bind:value={() => gamesPerEntrant, updateGamesPerEntrant}
                            min={tableSize}
                            max="256"
                            step={tableSize}
                            required
                        />
                    </div>
                    <div>
                        <Label for="tournament-concurrency" class="mb-2">At the same time</Label>
                        <Input
                            id="tournament-concurrency"
                            type="number"
                            bind:value={concurrency}
                            min="1"
                            max={gamesPerEntrant}
                            required
                        />
                    </div>
                </div>
                {#if registrationKind === 'whenFull'}
                    <div>
                        <Label for="tournament-capacity" class="mb-2">Roster size</Label>
                        <Input
                            id="tournament-capacity"
                            type="number"
                            bind:value={capacity}
                            min={tableSize}
                            max="256"
                            required
                        />
                        <Helper class="mt-1 text-xs"
                            >Starts one minute after the roster fills.</Helper
                        >
                    </div>
                {:else}
                    <div>
                        <Label for="tournament-minimum" class="mb-2">Minimum players</Label>
                        <Input
                            id="tournament-minimum"
                            type="number"
                            bind:value={minimumEntrants}
                            min={tableSize}
                            max="256"
                            required
                        />
                        <Helper class="mt-1 text-xs"
                            >Cancels if fewer than {minimumEntrants} players join.</Helper
                        >
                    </div>
                    <Toggle bind:checked={capped}>Limit roster size</Toggle>
                    {#if capped}
                        <div>
                            <Label for="tournament-capacity" class="mb-2">Maximum players</Label>
                            <Input
                                id="tournament-capacity"
                                type="number"
                                bind:value={capacity}
                                min={minimumEntrants}
                                max="256"
                                required
                            />
                        </div>
                    {/if}
                {/if}
            </div>
        </details>
        <details>
            <summary class="cursor-pointer text-sm text-gray-500 dark:text-gray-400"
                >Description <span class="text-xs">(optional)</span></summary
            >
            <Label for="tournament-description" class="sr-only">Description</Label>
            <Textarea
                id="tournament-description"
                class="mt-2"
                bind:value={description}
                maxlength={2000}
                rows={2}
            />
        </details>
        {#if error}<Helper color="red" role="alert">{error}</Helper>{/if}
        <div class="flex items-center justify-between pt-2">
            <Button color="light" type="button" onclick={oncancel}>Cancel</Button>
            <Button type="submit" disabled={!game.titleId}
                >{busy ? 'Saving…' : tournament ? 'Save draft' : 'Create draft'}</Button
            >
        </div>
    </fieldset>
</form>
