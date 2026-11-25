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
    import CompetitionScoringField from '../tournaments/CompetitionScoringField.svelte'
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
    import RichMessage from '$lib/components/RichMessage.svelte'
    import { m } from '$lib/paraglide/messages'
    import { leagueShapeText } from '$lib/utils/leaguePresentation'

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
        initial?.rules.gameConfig,
        initial?.rules.scoring
    )
    let title = $derived(game.title)
    let config = $derived(game.config)
    let leagueTitles = $derived(game.titles.filter((item) => playerCounts(item).length))

    onMount(() => game.loadEligibleTitles(api, m.leagues_form_titles_load_failed()))

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
                    scoring: game.scoring
                },
                signUp: { opensAutomatically, days: signUpDays }
            }
            onsaved(
                league ? await api.updateLeague(league, draft) : await api.createLeague(id, draft)
            )
        } catch (failure) {
            error = failure instanceof Error ? failure.message : m.leagues_form_save_failed()
        } finally {
            busy = false
        }
    }
</script>

{#snippet optionalHint(text: string)}<span class="text-xs">{text}</span>{/snippet}

<h1 class="mb-5 font-tournament text-2xl font-semibold text-gray-900 dark:text-gray-200">
    {league ? m.leagues_form_edit_heading() : m.leagues_create_league()}
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
            <Label for="league-name" class="mb-2">{m.leagues_form_name()}</Label>
            <Input
                id="league-name"
                bind:value={name}
                placeholder={m.leagues_form_name_placeholder()}
                required
                maxlength={120}
            />
        </div>
        <div>
            <Label for="league-game" class="mb-2">{m.leagues_format_game()}</Label>
            <TournamentSelect
                id="league-game"
                value={game.titleId}
                placeholder={m.leagues_form_game_placeholder()}
                options={leagueTitles.map((item) => ({
                    value: item.info.id,
                    name: item.info.metadata.name
                }))}
                onchange={selectTitle}
            />
            {#if game.titlesError}<Helper color="red" class="mt-1">{game.titlesError}</Helper
                >{:else if libraryService.loading || !game.eligibleTitleIds}<Helper class="mt-1"
                    >{m.leagues_form_loading_titles()}</Helper
                >{/if}
        </div>
        <div>
            <Label class="mb-2">{m.leagues_format_shape()}</Label>
            <ButtonGroup aria-label={m.leagues_form_shape_label()}>
                <RadioButton
                    value="pyramid"
                    bind:group={shape}
                    checkedClass="dark:hover:bg-transparent dark:bg-transparent dark:text-primary-500 dark:hover:text-primary-500 dark:focus-within:text-primary-500"
                    >{leagueShapeText('pyramid')}</RadioButton
                >
                <RadioButton
                    value="ladder"
                    bind:group={shape}
                    checkedClass="dark:hover:bg-transparent dark:bg-transparent dark:text-primary-500 dark:hover:text-primary-500 dark:focus-within:text-primary-500"
                    >{leagueShapeText('ladder')}</RadioButton
                >
            </ButtonGroup>
            <Helper class="mt-1 text-xs"
                >{shape === 'pyramid'
                    ? m.leagues_form_pyramid_help()
                    : m.leagues_form_ladder_help()}</Helper
            >
        </div>
        {#if title}
            <div>
                <Label class="mb-2">{m.leagues_form_players_per_game()}</Label>
                <ButtonGroup aria-label={m.leagues_form_players_per_game()}>
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
        {#if game.supportsPlacement}
            <CompetitionScoringField {game} />
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
        <Toggle bind:checked={opensAutomatically}>{m.leagues_opens_automatically()}</Toggle>
        <div>
            <Label for="league-sign-up-days" class="mb-2">{m.leagues_form_sign_up_days()}</Label>
            <Input
                id="league-sign-up-days"
                type="number"
                bind:value={signUpDays}
                min={leagueSignUpDays.minimum}
                max={leagueSignUpDays.maximum}
                required
            />
            <Helper class="mt-1 text-xs">{m.leagues_form_sign_up_days_help()}</Helper>
        </div>
        <details>
            <summary class="cursor-pointer text-sm text-gray-500 dark:text-gray-400"
                >{m.leagues_form_advanced()}</summary
            >
            <div class="mt-4 grid grid-cols-2 gap-4">
                <div>
                    <Label for="league-games" class="mb-2"
                        >{m.leagues_form_games_per_player()}</Label
                    >
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
                    <Label for="league-concurrency" class="mb-2"
                        >{m.leagues_form_concurrency()}</Label
                    >
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
                    >{m.leagues_form_group_sizes({
                        groupSize: sizes.groupSize,
                        bottomMinimum: sizes.bottomMinimum,
                        bottomMaximum: sizes.bottomMaximum
                    })}</Helper
                >
            {/if}
        </details>
        <details>
            <summary class="cursor-pointer text-sm text-gray-500 dark:text-gray-400"
                ><RichMessage
                    parts={m.leagues_form_description_optional.parts()}
                    markup={{ optional: optionalHint }}
                /></summary
            >
            <Label for="league-description" class="sr-only">{m.leagues_form_description()}</Label>
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
            <Button color="light" type="button" onclick={oncancel}>{m.cancel()}</Button>
            <Button type="submit" disabled={!game.titleId}
                >{busy
                    ? m.saving()
                    : league
                      ? m.leagues_form_save_draft()
                      : m.leagues_form_create_draft()}</Button
            >
        </div>
    </fieldset>
</form>
