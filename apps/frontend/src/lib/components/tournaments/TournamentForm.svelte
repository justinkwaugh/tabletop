<script lang="ts">
    import { Select } from 'flowbite-svelte'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import {
        defaultGameConfig,
        getMiniTournamentDefaults,
        miniTournamentDefaults,
        ConfigOptionType,
        type Tournament,
        type TournamentDraft,
        type GameConfig,
        type ConfigOption
    } from '@tabletop/common'
    import { untrack } from 'svelte'
    import { nanoid } from 'nanoid'

    let {
        tournament,
        onsaved,
        disabled = false
    }: {
        tournament?: Tournament
        onsaved: (tournament: Tournament) => void
        disabled?: boolean
    } = $props()
    const { api, libraryService } = getAppContext()
    const initial = untrack(() => tournament)
    const id = initial?.id ?? nanoid()
    let name = $state(initial?.name ?? '')
    let description = $state(initial?.description ?? '')
    let titleId = $state(initial?.rules.titleId ?? '')
    let tableSize = $state(initial?.rules.tableSize ?? 4)
    let registrationKind = $state<'whenFull' | 'deadline'>(
        initial?.rules.registration.kind ?? 'whenFull'
    )
    let minimumEntrants = $state(
        initial?.rules.registration.kind === 'deadline'
            ? initial.rules.registration.minimumEntrants
            : miniTournamentDefaults[4].capacity
    )
    let capacity = $state(
        initial?.rules.registration.capacity ?? miniTournamentDefaults[4].capacity
    )
    let capped = $state(initial?.rules.registration.capacity !== undefined)
    let gamesPerEntrant = $state(
        initial?.format.stages[0].gamesPerEntrant ?? miniTournamentDefaults[4].gamesPerEntrant
    )
    let concurrency = $state(
        initial?.rules.concurrency ?? miniTournamentDefaults[4].gamesPerEntrant
    )
    let config: GameConfig = $state({ ...initial?.rules.gameConfig })
    const initialDeadline = new Date(
        initial?.rules.registration.kind === 'deadline'
            ? initial.rules.registration.closesAt
            : Date.now() + 7 * 86_400_000
    )
    let deadline = $state(
        new Date(initialDeadline.getTime() - initialDeadline.getTimezoneOffset() * 60_000)
            .toISOString()
            .slice(0, 16)
    )
    let busy = $state(false)
    let error = $state('')
    let title = $derived(libraryService.titlesById[titleId])
    let titles = $derived(
        Object.values(libraryService.titlesById).sort((a, b) =>
            a.info.metadata.name.localeCompare(b.info.metadata.name)
        )
    )

    function selectTitle(selectedTitleId: string) {
        titleId = selectedTitleId
        const selected = libraryService.titlesById[titleId]
        if (!selected) return
        tableSize = selected.info.metadata.defaultPlayerCount
        applyMiniDefaults()
        config = defaultGameConfig(selected.info.configurator?.options ?? [])
    }

    function applyMiniDefaults() {
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

    function updateOption(option: ConfigOption, value: string | number | boolean | null) {
        title?.info.configurator?.updateConfig(config, { id: option.id, value })
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
                    titleId,
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

<form
    onsubmit={(event) => {
        event.preventDefault()
        void save()
    }}
    class="space-y-5"
>
    <fieldset disabled={disabled || busy} class="space-y-5 disabled:opacity-60">
        <p class="text-sm">Mini tournament · One stage</p>
        <label>Name<input bind:value={name} required maxlength="120" /></label>
        <label
            >Description<textarea bind:value={description} maxlength="2000" rows="3"
            ></textarea></label
        >
        <label
            >Game<Select
                size="sm"
                placeholder=""
                value={titleId}
                onchange={(event) => selectTitle(event.currentTarget.value)}
                required
                ><option value="">Choose a game</option>{#each titles as item (item.info.id)}<option
                        value={item.info.id}>{item.info.metadata.name}</option
                    >{/each}</Select
            ></label
        >
        {#if libraryService.loading}<p>Loading game titles…</p>{:else if !titles.length}<p
                role="alert"
            >
                Game titles are unavailable. Refresh when the game library is available.
            </p>{/if}
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label
                >Players per game<input
                    type="number"
                    bind:value={tableSize}
                    onchange={applyMiniDefaults}
                    min={title?.info.metadata.minPlayers ?? 2}
                    max={title?.info.metadata.maxPlayers ?? 16}
                    required
                /></label
            >
            <label
                >Games per player<input
                    type="number"
                    bind:value={() => gamesPerEntrant, updateGamesPerEntrant}
                    min={tableSize}
                    max="256"
                    step={tableSize}
                    required
                /></label
            >
            <label
                >Concurrent games per player<input
                    type="number"
                    bind:value={concurrency}
                    min="1"
                    max={gamesPerEntrant}
                    required
                /></label
            >
        </div>
        <label
            >Registration closes<Select size="sm" placeholder="" bind:value={registrationKind}
                ><option value="whenFull">When the tournament fills</option><option value="deadline"
                    >On a specified date</option
                ></Select
            ></label
        >
        {#if registrationKind === 'whenFull'}
            <label
                >Roster size<input
                    type="number"
                    bind:value={capacity}
                    min={tableSize}
                    max="256"
                    required
                /></label
            >
            <p class="text-sm">No deadline. Registration locks when the roster fills.</p>
        {:else}
            <div class="grid gap-4 sm:grid-cols-2">
                <label
                    >Minimum entrants<input
                        type="number"
                        bind:value={minimumEntrants}
                        min={tableSize}
                        max="256"
                        required
                    /></label
                >
                <label
                    >Closing date (your local time)<input
                        type="datetime-local"
                        bind:value={deadline}
                        required
                    /></label
                >
                <label
                    ><span>Limit enrollment</span><input
                        type="checkbox"
                        bind:checked={capped}
                    /></label
                >
                {#if capped}<label
                        >Maximum entrants<input
                            type="number"
                            bind:value={capacity}
                            min={minimumEntrants}
                            max="256"
                            required
                        /></label
                    >{/if}
            </div>
            <p class="text-sm">
                The final roster is everyone enrolled at the closing date. Below the minimum, the
                event cancels.
            </p>
        {/if}
        {#if title?.info.configurator?.options.length}
            <fieldset class="space-y-3 rounded-lg border border-gray-300 p-4 dark:border-gray-600">
                <legend class="px-2">Game options</legend>
                {#each title.info.configurator.options as option (option.id)}
                    <label
                        >{option.name}
                        {#if option.type === ConfigOptionType.Boolean}
                            <input
                                type="checkbox"
                                checked={config[option.id] === true}
                                onchange={(event) =>
                                    updateOption(option, event.currentTarget.checked)}
                            />
                        {:else if option.type === ConfigOptionType.List}
                            <Select
                                size="sm"
                                placeholder=""
                                value={String(config[option.id] ?? '')}
                                onchange={(event) =>
                                    updateOption(option, event.currentTarget.value)}
                                >{#each option.options as choice (choice.value)}<option
                                        value={choice.value}>{choice.name}</option
                                    >{/each}</Select
                            >
                        {:else if option.type === ConfigOptionType.NumberInput}
                            <input
                                type="number"
                                value={typeof config[option.id] === 'number'
                                    ? config[option.id]
                                    : undefined}
                                onchange={(event) =>
                                    updateOption(
                                        option,
                                        event.currentTarget.value === ''
                                            ? null
                                            : event.currentTarget.valueAsNumber
                                    )}
                            />
                        {:else}
                            <input
                                value={String(config[option.id] ?? '')}
                                onchange={(event) =>
                                    updateOption(option, event.currentTarget.value)}
                            />
                        {/if}
                        <span class="text-xs font-normal text-gray-600 dark:text-gray-400"
                            >{option.description}</span
                        >
                    </label>
                {/each}
            </fieldset>
        {/if}
        <p class="text-sm text-gray-600 dark:text-gray-400">
            Each game awards one win credit, divided equally between joint winners. Rules freeze
            when registration opens.
        </p>
        <button class="rounded bg-blue-700 px-5 py-2 text-white" type="submit"
            >{busy ? 'Saving…' : tournament ? 'Save draft' : 'Create draft'}</button
        >
    </fieldset>
    {#if error}<p role="alert" class="text-red-600 dark:text-red-300">{error}</p>{/if}
</form>

<style>
    label {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.875rem;
        font-weight: 500;
    }
    input:not([type='checkbox']),
    textarea {
        width: 100%;
        border: 1px solid #6b7280;
        border-radius: 0.5rem;
        padding: 0.6rem 0.75rem;
        color: inherit;
        background: transparent;
    }
    option {
        color: #111827;
        background: white;
    }
    input[type='checkbox'] {
        width: 1.25rem;
        height: 1.25rem;
    }
</style>
