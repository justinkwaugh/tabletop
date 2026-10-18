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
    import TournamentSelect from '../tournaments/TournamentSelect.svelte'
    import GameConfigFields from '../tournaments/GameConfigFields.svelte'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import {
        leagueGroupSizesFor,
        leagueSignUpDays,
        getMiniTournamentDefaults,
        range,
        type League,
        type LeagueDraft,
        type LeagueShape
    } from '@tabletop/common'
    import { onMount, untrack } from 'svelte'
    import { CompetitionGameChoice } from '../tournaments/competitionGameChoice.svelte'
    import { nanoid } from 'nanoid'

    let {
        league,
        onsaved,
        oncancel,
        disabled = false
    }: {
        league?: League
        onsaved: (league: League) => void
        oncancel: () => void
        disabled?: boolean
    } = $props()
    const { api, libraryService } = getAppContext()
    const initial = untrack(() => league)
    const id = initial?.id ?? nanoid()
    let name = $state(initial?.name ?? '')
    let description = $state(initial?.description ?? '')
    let shape = $state<LeagueShape>(initial?.shape ?? 'pyramid')
    let tableSize = $state(initial?.rules.tableSize ?? 4)
    let gamesPerEntrant = $state(initial?.rules.gamesPerEntrant ?? 4)
    let concurrency = $state(initial?.rules.concurrency ?? 4)
    let opensAutomatically = $state(initial?.signUp.opensAutomatically ?? true)
    let signUpDays = $state(initial?.signUp.days ?? 7)
    let busy = $state(false)
    let error = $state('')
    let sizes = $derived(leagueGroupSizesFor(tableSize))

    const game = new CompetitionGameChoice(
        libraryService,
        initial?.rules.titleId,
        initial?.rules.gameConfig
    )
    let title = $derived(game.title)
    let config = $derived(game.config)
    let leagueTitles = $derived(game.titles.filter((item) => playerCounts(item).length))

    onMount(() => game.loadEligibleTitles(api, 'Could not load the games available for leagues.'))

    function playerCounts(item: {
        info: { metadata: { minPlayers: number; maxPlayers: number } }
    }) {
        const { minPlayers, maxPlayers } = item.info.metadata
        return range(minPlayers, maxPlayers - minPlayers + 1).filter(
            (count) => leagueGroupSizesFor(count) !== undefined
        )
    }

    function selectTitle(selectedTitleId: string) {
        const selected = game.select(selectedTitleId)
        if (!selected) return
        const counts = playerCounts(selected)
        const preferred = selected.info.metadata.defaultPlayerCount
        setTableSize(counts.includes(preferred) ? preferred : (counts.at(-1) ?? preferred))
    }

    function setTableSize(value: number) {
        tableSize = value
        gamesPerEntrant = getMiniTournamentDefaults(tableSize)?.gamesPerEntrant ?? tableSize
        concurrency = gamesPerEntrant
    }

    async function save() {
        busy = true
        error = ''
        try {
            const draft: LeagueDraft = {
                name,
                description,
                shape,
                rules: {
                    titleId: game.titleId,
                    tableSize,
                    gamesPerEntrant,
                    concurrency,
                    gameConfig: config,
                    scoring: 'splitWinsV1'
                },
                signUp: { opensAutomatically, days: signUpDays }
            }
            onsaved(
                league ? await api.updateLeague(league, draft) : await api.createLeague(id, draft)
            )
        } catch (failure) {
            error = failure instanceof Error ? failure.message : 'Could not save the league'
        } finally {
            busy = false
        }
    }
</script>

<h1 class="mb-5 font-tournament text-2xl font-semibold text-gray-900 dark:text-gray-200">
    {league ? 'Edit league' : 'Create league'}
</h1>
<form
    onsubmit={(event) => {
        event.preventDefault()
        void save()
    }}
    class="text-left"
>
    <fieldset disabled={disabled || busy} class="space-y-4 disabled:opacity-60">
        <div>
            <Label for="league-name" class="mb-2">Name</Label>
            <Input
                id="league-name"
                bind:value={name}
                placeholder="Choose a name for your league"
                required
                maxlength={120}
            />
        </div>
        <div>
            <Label for="league-game" class="mb-2">Game</Label>
            <TournamentSelect
                id="league-game"
                value={game.titleId}
                placeholder="Choose a game"
                options={leagueTitles.map((item) => ({
                    value: item.info.id,
                    name: item.info.metadata.name
                }))}
                onchange={selectTitle}
            />
            {#if game.titlesError}<Helper color="red" class="mt-1">{game.titlesError}</Helper
                >{:else if libraryService.loading || !game.eligibleTitleIds}<Helper class="mt-1"
                    >Loading game titles…</Helper
                >{/if}
        </div>
        <div>
            <Label class="mb-2">Shape</Label>
            <ButtonGroup aria-label="League shape">
                <RadioButton
                    value="pyramid"
                    bind:group={shape}
                    checkedClass="dark:hover:bg-transparent dark:bg-transparent dark:text-primary-500 dark:hover:text-primary-500 dark:focus-within:text-primary-500"
                    >Pyramid</RadioButton
                >
                <RadioButton
                    value="ladder"
                    bind:group={shape}
                    checkedClass="dark:hover:bg-transparent dark:bg-transparent dark:text-primary-500 dark:hover:text-primary-500 dark:focus-within:text-primary-500"
                    >Ladder</RadioButton
                >
            </ButtonGroup>
            <Helper class="mt-1 text-xs"
                >{shape === 'pyramid'
                    ? 'Each level has twice the groups of the one above. Group winners go up; the bottom two go down.'
                    : 'One group per level. The top two go up; the bottom two go down.'}</Helper
            >
        </div>
        {#if title}
            <div>
                <Label class="mb-2">Players per game</Label>
                <ButtonGroup aria-label="Players per game">
                    {#each playerCounts(title) as count (count)}
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
        <Toggle bind:checked={opensAutomatically}>Open the next sign-up when a season ends</Toggle>
        <div>
            <Label for="league-sign-up-days" class="mb-2">Sign-up lasts (days)</Label>
            <Input
                id="league-sign-up-days"
                type="number"
                bind:value={signUpDays}
                min={leagueSignUpDays.minimum}
                max={leagueSignUpDays.maximum}
                required
            />
            <Helper class="mt-1 text-xs"
                >Returning players confirm their places in this time. Groups start when it closes.</Helper
            >
        </div>
        <details>
            <summary class="cursor-pointer text-sm text-gray-500 dark:text-gray-400"
                >Advanced</summary
            >
            <div class="mt-4 grid grid-cols-2 gap-4">
                <div>
                    <Label for="league-games" class="mb-2">Games per player</Label>
                    <Input
                        id="league-games"
                        type="number"
                        bind:value={gamesPerEntrant}
                        min={tableSize}
                        max="256"
                        step={tableSize}
                        required
                    />
                </div>
                <div>
                    <Label for="league-concurrency" class="mb-2">At the same time</Label>
                    <Input
                        id="league-concurrency"
                        type="number"
                        bind:value={concurrency}
                        min="1"
                        max={gamesPerEntrant}
                        required
                    />
                </div>
            </div>
            {#if sizes}
                <Helper class="mt-2 text-xs"
                    >Groups of {sizes.groupSize}; bottom-level groups hold {sizes.bottomMinimum} to
                    {sizes.bottomMaximum} players.</Helper
                >
            {/if}
        </details>
        <details>
            <summary class="cursor-pointer text-sm text-gray-500 dark:text-gray-400"
                >Description <span class="text-xs">(optional)</span></summary
            >
            <Label for="league-description" class="sr-only">Description</Label>
            <Textarea
                id="league-description"
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
                >{busy ? 'Saving…' : league ? 'Save draft' : 'Create draft'}</Button
            >
        </div>
    </fieldset>
</form>
