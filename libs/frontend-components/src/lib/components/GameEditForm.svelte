<script lang="ts">
    import { untrack } from 'svelte'
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
        GameVisibility,
        getTitleVisibility,
        defaultGameConfig,
        normalizeGameConfig,
        type GameCreationOptions,
        assert,
        assertExists,
        BooleanConfigOption,
        ConfigOption,
        Game,
        GameConfig,
        GameState,
        GameStorage,
        isBooleanConfigOption,
        isListConfigOption,
        listOptionDescription,
        isNumberInputConfigOption,
        isStringInputConfigOption,
        ListConfigOption,
        NumberInputConfigOption,
        Player,
        PlayerStatus,
        type User,
        range,
        StringInputConfigOption,
        type HydratedGameState
    } from '@tabletop/common'
    import { nanoid } from 'nanoid'
    import { playerSortValue } from '$lib/utils/player'
    import { TrashBinSolid } from 'flowbite-svelte-icons'
    import type { GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
    import { APIError } from '$lib/network/errors.js'
    import { trim } from '$lib/utils/trimInput.js'
    import Typeahead from '$lib/components/Typeahead.svelte'
    import { getAppContext } from '$lib/model/appContext.js'
    import {
        GameCreationPrivileges,
        parseReproductionSeed,
        type ReproductionSeed
    } from '$lib/model/gameCreationPrivileges.svelte.js'

    type EditableGame = Pick<
        Game,
        'id' | 'typeId' | 'name' | 'players' | 'isPublic' | 'hotseat' | 'ownerId' | 'config'
    >
    const EditMode = {
        Create: 'create',
        Edit: 'edit'
    } as const
    type EditMode = (typeof EditMode)[keyof typeof EditMode]

    let {
        game,
        continueFrom,
        title,
        hotseatOnly = false,
        showHeading = true,
        oncancel,
        onsave
    }: {
        game?: Game
        continueFrom?: Game
        title?: GameUiDefinition<GameState, HydratedGameState>
        hotseatOnly?: boolean
        showHeading?: boolean
        oncancel: () => void
        onsave: (game: Game) => void
    } = $props()

    let { libraryService, authorizationService, gameService } = getAppContext()
    let titlesById = $derived(libraryService.titlesById)
    let sessionUser = authorizationService.getSessionUser()

    let mode = game ? EditMode.Edit : EditMode.Create
    let gameTitle = $derived.by(() => {
        let gameTitle = title
        const existingGame = game ?? continueFrom
        if (!gameTitle && existingGame) {
            gameTitle = titlesById[existingGame.typeId]
        }
        assertExists(gameTitle, 'No title found for the game being edited')
        return gameTitle
    })

    let editedGame: EditableGame = game
        ? $state.snapshot(game)
        : continueFrom
          ? continuationGame(continueFrom)
          : <EditableGame>{
                id: nanoid(),
                typeId: '',
                name: '',
                players: [ownerPlayer()],
                isPublic: false,
                hotseat: false,
                ownerId: sessionUser?.id,
                config: {}
            }

    // State
    let unexpectedError = $state(false)
    let errors: Record<string, string[]> = $state({})
    let name = $state(editedGame.name)
    let config = $state(
        untrack(() => normalizeGameConfig(editedGame.config, gameTitle.info.configurator))
    )
    const privileges = new GameCreationPrivileges(authorizationService)
    let numPlayers = $state(
        mode === EditMode.Edit || continueFrom
            ? editedGame.players.length
            : (gameTitle.info.metadata.defaultPlayerCount ?? 1)
    )
    let players: Player[] = $state(editedGame.players)
    let isPublic: boolean = $state(editedGame.isPublic)
    let isHotseat: boolean = $state(hotseatOnly || editedGame.hotseat)
    let publicGame = $derived(isPublic || privileges.unlisted)
    let showUnlistedToggle = $derived(
        privileges.canChooseUnlisted && mode === EditMode.Create && !isHotseat
    )
    let showPublicToggle = $derived(
        getTitleVisibility(gameTitle.info.metadata) === GameVisibility.Public &&
            mode === EditMode.Create &&
            !isHotseat &&
            !privileges.unlisted
    )
    let showHotseatToggle = $derived(
        !hotseatOnly && !continueFrom && !publicGame && privileges.ownerIncluded
    )
    let reclaimableOwnerSeat = $derived.by(() => {
        const ownNameSeat = players.findIndex((player) => player.name === sessionUser?.username)
        return ownNameSeat !== -1
            ? ownNameSeat
            : players.findIndex((player) => player.status === PlayerStatus.Open)
    })
    let canIncludeOwner = $derived(privileges.ownerIncluded || reclaimableOwnerSeat !== -1)
    let showIncludeOwnerToggle = $derived(
        (privileges.canExcludeOwner || !privileges.ownerIncluded) &&
            mode === EditMode.Create &&
            !hotseatOnly &&
            !isHotseat
    )
    let minPlayers: number = $derived(gameTitle?.info.metadata.minPlayers ?? 1)
    let maxPlayers: number = $derived(gameTitle?.info.metadata.maxPlayers ?? 1)

    function generateDefaultOptions() {
        return defaultGameConfig(gameTitle.info.configurator?.options ?? [])
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

        assertExists(gameTitle?.info.configurator, 'No configurator found for selected title')
        gameTitle.info.configurator.updateConfig(config, { id: option.id, value })
    }

    function ownerPlayer(): Player {
        assertExists(sessionUser?.username, 'Creating a game requires a user with a username')
        return {
            id: nanoid(),
            userId: sessionUser.id,
            isHuman: true,
            name: sessionUser.username,
            status: PlayerStatus.Joined
        }
    }

    function continuationGame(source: Game): EditableGame {
        assertExists(sessionUser, 'Continuing a game requires a signed-in user')
        const user = sessionUser
        return {
            id: nanoid(),
            typeId: source.typeId,
            name: source.name,
            players: source.players.map((player) =>
                isUsersSeat(source, player, user) ? ownerPlayer() : continuedPlayer(source, player)
            ),
            isPublic: source.isPublic,
            hotseat: source.hotseat,
            ownerId: sessionUser.id,
            config: structuredClone(source.config)
        }
    }

    function isUsersSeat(source: Game, player: Player, user: User) {
        return source.hotseat ? player.name === user.username : player.userId === user.id
    }

    function continuedPlayer(source: Game, player: Player): Player {
        return {
            id: nanoid(),
            isHuman: player.isHuman,
            ...(source.hotseat || !player.userId ? {} : { userId: player.userId }),
            name: player.name,
            status: player.name ? PlayerStatus.Reserved : PlayerStatus.Open
        }
    }

    function openPlayer(): Player {
        return { id: nanoid(), isHuman: true, name: '', status: PlayerStatus.Open }
    }

    function setOwnerIncluded(included: boolean) {
        if (included) {
            assert(reclaimableOwnerSeat !== -1, 'Including the owner requires a free seat')
            players.splice(reclaimableOwnerSeat, 1)
            players.unshift(ownerPlayer())
        } else {
            const ownerIndex = players.findIndex(isOwner)
            players[ownerIndex] = openPlayer()
        }
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
                players.push(openPlayer())
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
        let reproduction: ReproductionSeed | undefined
        if (mode === EditMode.Create && privileges.seed.length > 0) {
            try {
                const runtime = await gameTitle.runtime()
                if (privileges.seed.length > 0) {
                    reproduction = parseReproductionSeed(privileges.seed, runtime)
                }
            } catch {
                errors['seed'] = [
                    'Use a 32-digit hexadecimal reproduction seed, or a number for legacy titles'
                ]
                return
            }
        }
        if (privileges.ownerExclusionLapsed) {
            return
        }

        const form = event.target as HTMLFormElement
        if (!form.reportValidity()) {
            return
        }
        const formData = new FormData(form)

        const playersToUpload = $state.snapshot(players)
        for (const player of Object.values(playersToUpload)) {
            if (player.name) {
                player.status = isHotseat ? PlayerStatus.Joined : PlayerStatus.Reserved
            }
        }

        const chosenConfig = $state.snapshot(config)
        const defaultConfig = generateDefaultOptions()
        const mergedConfig = normalizeGameConfig({ ...defaultConfig, ...chosenConfig })

        const gameData = <Partial<Game>>{
            id: editedGame.id,
            name: (formData.get('name') as string).trim(),
            players: playersToUpload,
            isPublic: publicGame,
            ...(privileges.unlisted ? { unlisted: true } : {}),
            hotseat: !publicGame && isHotseat,
            storage: !publicGame && isHotseat ? GameStorage.Local : GameStorage.Remote,
            ownerId: editedGame.ownerId,
            config: mergedConfig
        }

        let options: GameCreationOptions | undefined = continueFrom
            ? { continueFromGameId: continueFrom.id }
            : undefined
        if (mode === EditMode.Create) {
            gameData.typeId = gameTitle.info.id
            if (reproduction) {
                if ('masterSeed' in reproduction) {
                    if (gameService.supportsReproductionSeed !== true) {
                        errors['seed'] = ['Reload the site to use reproduction seeds']
                        return
                    }
                    options = { ...options, masterSeed: reproduction.masterSeed }
                } else {
                    gameData.seed = reproduction.seed
                }
            }
        }

        try {
            let updatedGame: Game
            if (mode === EditMode.Create) {
                updatedGame = await gameService.createGame(gameData, options)
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
        delete player.userId
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
        value={`${config[option.id] ?? option.default}`}
        required
        class="w-fit"
    />
    <Helper class="mt-1 text-[.65rem] dark:text-gray-400 leading-tight">
        {listOptionDescription(option, config[option.id])}
    </Helper>
{/snippet}

{#if showHeading}
    <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-200 mb-4">
        {gameTitle.info.metadata.name}
    </h1>
{/if}
{#if continueFrom}
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Continues from {continueFrom.name}
    </p>
{/if}
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
        {#each errors.name as error, i (i)}
            <Helper class="mb-2" color="red"><span class="font-medium">{error}</span></Helper>
        {/each}
    {/if}
    <Label class="mb-2">
        <span>Player Count</span>
    </Label>
    <ButtonGroup>
        {#each range(minPlayers, maxPlayers - minPlayers + 1) as i (i)}
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
                required={isHotseat || !publicGame}
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
                                    delete player.userId
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
                {#each errors[player.id] as error, errorIndex (errorIndex)}
                    <Helper color="red"><span class="font-medium">{error}</span></Helper>
                {/each}
            {/if}
        {/each}
    </div>
    {#if showPublicToggle || showUnlistedToggle || showHotseatToggle || showIncludeOwnerToggle}
        <div class="flex flex-row items-center gap-6">
            {#if showIncludeOwnerToggle}
                <Toggle
                    bind:checked={privileges.ownerIncluded}
                    disabled={!canIncludeOwner}
                    onchange={() => setOwnerIncluded(privileges.ownerIncluded)}>Include me</Toggle
                >
            {/if}
            {#if showPublicToggle}
                <Toggle bind:checked={isPublic}>Public</Toggle>
            {/if}
            {#if showUnlistedToggle}
                <Toggle bind:checked={privileges.unlistedChoice}>Unlisted</Toggle>
            {/if}
            {#if showHotseatToggle}
                <Toggle bind:checked={isHotseat}>Hotseat</Toggle>
            {/if}
        </div>
        {#if showIncludeOwnerToggle && !canIncludeOwner}
            <Helper>Clear a seat to include yourself</Helper>
        {/if}
        {#if privileges.ownerExclusionLapsed}
            <Helper color="red"
                >Admin Mode has ended, so the game needs your seat. Include yourself, or enter Admin
                Mode again.</Helper
            >
        {/if}
    {/if}
    {#if gameTitle.info.configurator && gameTitle.info.configurator.options.length > 0}
        <div
            class="p-4 border-2 border-gray-700 rounded-lg flex flex-col space-y-4 justify-center items-start"
        >
            {#each gameTitle.info.configurator.options as option (option.id)}
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
    {#if privileges.canEnterSeed && mode === EditMode.Create}
        <Label class="mb-2">Reproduction seed</Label>
        <Input
            type="text"
            name="seed"
            bind:value={privileges.seedEntry}
            placeholder="optional reproduction seed"
        />
        {#each errors['seed'] ?? [] as error, i (i)}
            <Helper color="red">{error}</Helper>
        {/each}
    {/if}

    <div class="flex justify-between mt-6">
        <div><Button color="light" onclick={cancel}>Cancel</Button></div>
        <div>
            <Button type="submit">{mode === EditMode.Create ? 'Create Game' : 'Save'}</Button>
        </div>
    </div>
</form>
