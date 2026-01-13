<script lang="ts">
    import {
        Toggle,
        Label,
        Input,
        Button,
        Helper,
        Alert,
        Select,
        ButtonGroup,
        RadioButton
    } from 'flowbite-svelte'
    import {
        assertExists,
        BooleanConfigOption,
        ConfigOption,
        Game,
        GameConfig,
        GameState,
        GameStorage,
        isBooleanConfigOption,
        isListConfigOption,
        isNumberInputConfigOption,
        isStringInputConfigOption,
        ListConfigOption,
        NumberInputConfigOption,
        Player,
        PlayerStatus,
        range,
        StringInputConfigOption,
        type HydratedGameState
    } from '@tabletop/common'
    import { nanoid } from 'nanoid'
    import { getContext } from 'svelte'
    import { playerSortValue } from '$lib/utils/player'
    import { TrashBinSolid } from 'flowbite-svelte-icons'
    import type { GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
    import type { AppContext } from '$lib/model/appContext.js'
    import { APIError } from '$lib/network/errors.js'
    import { trim } from '$lib/utils/trimInput.js'
    import Typeahead from '$lib/components/Typeahead.svelte'

    type EditableGame = Pick<
        Game,
        'id' | 'typeId' | 'name' | 'players' | 'isPublic' | 'hotseat' | 'ownerId' | 'config'
    >
    enum EditMode {
        Create = 'create',
        Edit = 'edit'
    }

    let {
        game,
        title,
        hotseatOnly = false,
        oncancel,
        onsave
    }: {
        game?: Game
        title?: GameUiDefinition<GameState, HydratedGameState>
        hotseatOnly?: boolean
        oncancel: () => void
        onsave: (game: Game) => void
    } = $props()

    let { libraryService, authorizationService, gameService } = getContext(
        'appContext'
    ) as AppContext
    let sessionUser = authorizationService.getSessionUser()

    let mode = game ? EditMode.Edit : EditMode.Create
    let gameTitle = $derived.by(() => {
        let gameTitle = title
        if (!gameTitle && game) {
            gameTitle = libraryService.getTitle(game.typeId)
        }
        assertExists(gameTitle, 'No title found for the game being edited')
        return gameTitle
    })

    let editedGame: EditableGame = game
        ? $state.snapshot(game)
        : <EditableGame>{
              id: nanoid(),
              typeId: '',
              name: '',
              players: [
                  {
                      id: nanoid(),
                      userId: sessionUser?.id,
                      isHuman: true,
                      name: sessionUser?.username,
                      status: PlayerStatus.Joined
                  }
              ],
              isPublic: false,
              hotseat: false,
              ownerId: sessionUser?.id,
              config: {}
          }

    // State
    let unexpectedError = $state(false)
    let errors: Record<string, string[]> = $state({})
    let name = $state(editedGame.name)
    let config = $state(editedGame.config)
    let seed = $state('')
    let numPlayers = $state(
        mode === EditMode.Edit
            ? editedGame.players.length
            : (gameTitle.metadata.defaultPlayerCount ?? 1)
    )
    let players: Player[] = $state(editedGame.players)
    let isPublic: boolean = $state(editedGame.isPublic)
    let isHotseat: boolean = $state(hotseatOnly || editedGame.hotseat)
    let minPlayers: number = $derived(gameTitle?.metadata.minPlayers ?? 1)
    let maxPlayers: number = $derived(gameTitle?.metadata.maxPlayers ?? 1)

    function generateDefaultOptions() {
        const defaultConfig: GameConfig = {}
        for (const option of gameTitle.configurator?.options ?? []) {
            defaultConfig[option.id] = option.default ?? null
        }
        return defaultConfig
    }

    function onOptionChange(option: ConfigOption, event: Event) {
        let value: string | boolean | number | null | undefined = undefined
        if (isBooleanConfigOption(option)) {
            value = (event.target as HTMLInputElement).checked
        } else if (isListConfigOption(option)) {
            value = (event.target as HTMLSelectElement).value
        } else if (isStringInputConfigOption(option)) {
            value = (event.target as HTMLInputElement).value
        } else if (isNumberInputConfigOption(option)) {
            const val = (event.target as HTMLInputElement).value
            value = val ? parseInt(val) : null
        }
        if (value === undefined) {
            return
        }

        assertExists(gameTitle?.configurator, 'No configurator found for selected title')
        gameTitle.configurator.updateConfig(config, { id: option.id, value })
    }

    function updatePlayers(numPlayers: number) {
        const difference: number = numPlayers - players.length
        if (difference === 0) {
            return
        } else if (difference < 0) {
            sortPlayers(players)
            players.splice(numPlayers, -difference)
        } else {
            for (let i = 0; i < difference; i++) {
                players.push({ id: nanoid(), isHuman: true, name: '', status: PlayerStatus.Open })
            }
        }
    }

    function sortPlayers(players: Player[]) {
        players.sort((a, b) => {
            return playerSortValue(a, editedGame.ownerId) - playerSortValue(b, editedGame.ownerId)
        })
    }

    function isJoinedNonOwner(player: Player) {
        return player.userId != editedGame.ownerId && player.status === PlayerStatus.Joined
    }

    function isOwner(player: Player) {
        return player.userId === editedGame.ownerId
    }

    $effect(() => {
        updatePlayers(numPlayers)
    })

    async function submit(event: SubmitEvent) {
        event.preventDefault()
        event.stopPropagation()

        clearErrors()

        const form = event.target as HTMLFormElement
        const formData = new FormData(form)

        const playersToUpload = $state.snapshot(players)
        for (const player of Object.values(playersToUpload)) {
            if (player.name) {
                player.status = isHotseat ? PlayerStatus.Joined : PlayerStatus.Reserved
            }
        }

        const chosenConfig = $state.snapshot(config)
        const defaultConfig = generateDefaultOptions()
        const mergedConfig = Object.assign(defaultConfig, chosenConfig)

        // Remove null values from config
        for (const key of Object.keys(mergedConfig)) {
            if (mergedConfig[key] === null) {
                delete mergedConfig[key]
            }
        }

        const gameData = <Partial<Game>>{
            id: editedGame.id,
            name: (formData.get('name') as string).trim(),
            players: playersToUpload,
            isPublic,
            hotseat: !isPublic && isHotseat,
            storage: !isPublic && isHotseat ? GameStorage.Local : GameStorage.Remote,
            ownerId: editedGame.ownerId,
            config: mergedConfig
        }

        if (mode === EditMode.Create) {
            gameData.typeId = gameTitle.id
            if (seed.trim().length > 0) {
                try {
                    gameData.seed = parseInt(seed.trim())
                } catch {
                    errors['seed'] = ['The seed must be a valid number']
                    return
                }
            }
        }

        try {
            let updatedGame: Game
            if (mode === EditMode.Create) {
                updatedGame = await gameService.createGame(gameData)
            } else {
                updatedGame = await gameService.updateGame(gameData)
            }
            form.reset()
            onsave(updatedGame)
        } catch (e) {
            unexpectedError = true
            if (e instanceof APIError) {
                if (e.name === 'PlayersNotFoundError') {
                    let metadata = e.metadata as { players: Player[] }
                    for (const player of metadata.players) {
                        errors[player.id] = ['This player was not found']
                    }
                    unexpectedError = false
                } else if (e.name === 'DuplicatePlayerError') {
                    let metadata = e.metadata as { username: string; userId: string }
                    for (const player of players) {
                        if (
                            player.name === metadata.username ||
                            player.userId === metadata.userId
                        ) {
                            errors[player.id] = ['A player cannot be added more than once']
                        }
                    }
                    unexpectedError = false
                }
            } else {
                console.log(e)
            }
        }
    }

    async function handleNameInput(player: Player, event: Event) {
        trim(event)
        player.status = !player.name ? PlayerStatus.Open : PlayerStatus.Reserved
    }

    async function cancel(event: Event) {
        event.preventDefault()
        event.stopPropagation()
        oncancel()
    }

    function clearErrors() {
        unexpectedError = false
        errors = {}
    }
</script>

{#snippet stringInputOption(option: StringInputConfigOption)}
    <Label class="mb-2">
        {option.name}
    </Label>
    <Input
        onchange={(event: Event) => onOptionChange(option, event)}
        id={option.id}
        placeholder={option.placeholder}
        value={`${config[option.id] ?? option.default ?? ''}`}
    ></Input>
{/snippet}

{#snippet numberInputOption(option: NumberInputConfigOption)}
    <Label class="mb-2">
        {option.name}
    </Label>
    <Input
        type="number"
        onchange={(event: Event) => onOptionChange(option, event)}
        id={option.id}
        value={`${config[option.id] ?? option.default ?? ''}`}
    ></Input>
{/snippet}

{#snippet booleanOption(option: BooleanConfigOption)}
    <Toggle
        onchange={(event: Event) => onOptionChange(option, event)}
        id={option.id}
        checked={(config[option.id] as boolean) ?? option.default}
        ><div class="flex flex-col leading-tight justify-center items-start">
            {option.name}
            <Helper class="text-[.65rem] dark:text-gray-400 leading-tight">
                {option.description}
            </Helper>
        </div></Toggle
    >
{/snippet}

{#snippet listOption(option: ListConfigOption)}
    <Label class="mb-2">
        {option.name}
    </Label>
    <Select
        onchange={(event: Event) => onOptionChange(option, event)}
        id={option.id}
        size="sm"
        items={option.options}
        value={option.default}
        required
        class="w-fit"
    />
{/snippet}

<div class="flex flex-row w-full justify-between items-center mb-4">
    <div>
        <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-200">
            {gameTitle.metadata.name}
        </h1>
    </div>
    <div>
        {#if !hotseatOnly && !isPublic}
            <Toggle bind:checked={isHotseat} classes={{ span: 'me-0' }}
                >{#snippet offLabel()}Hotseat{/snippet}</Toggle
            >
        {/if}
    </div>
</div>
{#if unexpectedError}
    <Alert class="dark:bg-red-200 dark:text-red-700 mb-4">
        <span class="font-bold text-lg">Oops...</span><br />
        An unexpected error occurred. Please try again and hopefully it will be better next time.
    </Alert>
{/if}
<form class="flex flex-col space-y-4 text-left" action="/" onsubmit={submit}>
    <Label class="mb-2">Name</Label>
    <Input
        type="text"
        name="name"
        bind:value={name}
        placeholder="choose a name for your game"
        required
    />
    {#if errors?.name}
        {#each errors.name as error}
            <Helper class="mb-2" color="red"><span class="font-medium">{error}</span></Helper>
        {/each}
    {/if}
    <Label class="mb-2">
        <span>Player Count</span>
    </Label>
    <ButtonGroup>
        {#each range(minPlayers, maxPlayers - minPlayers + 1) as i}
            <RadioButton
                value={i}
                checkedClass="dark:hover:bg-transparent dark:bg-transparent dark:text-primary-500 dark:hover:text-primary-500 dark:focus-within:text-primary-500"
                bind:group={numPlayers}>{i}</RadioButton
            >
        {/each}
    </ButtonGroup>

    <Label class="mb-2">Players</Label>
    <div class="flex flex-col space-y-2">
        {#each players as player, i (player.id)}
            <Typeahead
                id={player.id}
                active={!isHotseat}
                oninput={(event: Event) => handleNameInput(player, event)}
                bind:text={player.name}
                exclude={players.map((p) => p.name)}
                size="md"
                type="text"
                name={player.id}
                placeholder="player name"
                color={errors[player.id] || player.status === PlayerStatus.Declined
                    ? 'red'
                    : isJoinedNonOwner(player)
                      ? 'green'
                      : 'default'}
                readonly={isOwner(player)}
                disabled={isOwner(player)}
                required={isHotseat || !isPublic}
            >
                <div class="flex flex-row justify-center align-center">
                    {#if isOwner(player)}
                        <div class="text-xs">HOST</div>
                    {:else}
                        {#if player.status === PlayerStatus.Declined}
                            <button
                                aria-label="reinvite"
                                type="button"
                                onclick={(event: Event) => {
                                    event.stopPropagation()
                                    player.status = PlayerStatus.Reserved
                                }}
                            >
                                <svg
                                    class="w-5 h-5 shrink-0"
                                    aria-hidden="true"
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke="currentColor"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M17.651 7.65a7.131 7.131 0 0 0-12.68 3.15M18.001 4v4h-4m-7.652 8.35a7.13 7.13 0 0 0 12.68-3.15M6 20v-4h4"
                                    ></path>
                                </svg>
                            </button>
                        {/if}
                        {#if player.status !== PlayerStatus.Open}
                            <button
                                type="button"
                                onclick={(event: Event) => {
                                    event.stopPropagation()
                                    player.name = ''
                                    player.status = PlayerStatus.Open
                                }}
                            >
                                <TrashBinSolid class="w-5 h-5" />
                            </button>
                        {/if}
                    {/if}
                </div>
            </Typeahead>
            {#if isJoinedNonOwner(player)}
                <Helper color="green">This player has accepted the invitation</Helper>
            {/if}
            {#if player.status === PlayerStatus.Declined}
                <Helper color="red"
                    >This player declined. Please replace or reinvite them (refresh icon)</Helper
                >
            {/if}
            {#if errors[player.id]}
                {#each errors[player.id] as error}
                    <Helper color="red"><span class="font-medium">{error}</span></Helper>
                {/each}
            {/if}
        {/each}
    </div>
    {#if !gameTitle.metadata.beta && mode === EditMode.Create}
        <Toggle bind:checked={isPublic}>Public</Toggle>
    {/if}
    {#if gameTitle.configurator && gameTitle.configurator.options.length > 0}
        <div
            class="p-4 border-2 border-gray-700 rounded-lg flex flex-col space-y-4 justify-center items-start"
        >
            {#each gameTitle.configurator.options as option (option.id)}
                {#if isBooleanConfigOption(option)}
                    {@render booleanOption(option)}
                {:else if isListConfigOption(option)}
                    {@render listOption(option)}
                {:else if isNumberInputConfigOption(option)}
                    {@render numberInputOption(option)}
                {:else if isStringInputConfigOption(option)}
                    {@render stringInputOption(option)}
                {/if}
            {/each}
        </div>
    {/if}
    {#if authorizationService.isAdmin && mode === EditMode.Create}
        <Label class="mb-2">Seed</Label>
        <Input type="text" name="seed" bind:value={seed} placeholder="optional game seed" />
    {/if}

    <div class="flex justify-between mt-6">
        <div><Button color="light" onclick={cancel}>Cancel</Button></div>
        <div>
            <Button type="submit">{mode === EditMode.Create ? 'Create Game' : 'Save'}</Button>
        </div>
    </div>
</form>
