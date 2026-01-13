<script lang="ts">
    import { Card, Hr, Button, Modal } from 'flowbite-svelte'
    import { Game, GameStatus, PlayerStatus, GameResult, ConfigOptionType } from '@tabletop/common'
    import { playerSortValue, playerStatusDisplay } from '$lib/utils/player'
    import { goto } from '$app/navigation'
    import TimeAgo from 'javascript-time-ago'
    import { fade, slide } from 'svelte/transition'
    import DeleteModal from './DeleteModal.svelte'
    import { GameEditForm, getAppContext } from '@tabletop/frontend-components'

    const timeAgo = new TimeAgo('en-US')

    let {
        game,
        ondecline,
        onstart,
        onjoin,
        ondelete,
        expanded = false
    }: {
        game: Game
        ondecline?: (game: Game) => void
        onjoin?: (game: Game) => void
        onstart?: (game: Game) => void
        ondelete?: (game: Game) => void
        expanded?: boolean | 'always'
    } = $props()

    let { libraryService, authorizationService, gameService } = getAppContext()

    let editing = $state(false)
    let canToggle = $derived(expanded !== 'always')
    let isExpanded = $derived(expanded ? true : false)

    let sessionUser = authorizationService.getSessionUser()
    let isOwnedByMe = $derived(sessionUser?.id === game.ownerId)
    let sortedPlayers = $derived(
        game.players.sort(
            (a, b) => playerSortValue(a, game.ownerId) - playerSortValue(b, game.ownerId)
        )
    )

    let myPlayer = $derived(sortedPlayers.find((player) => player.userId === sessionUser?.id))
    let isMine = $derived(myPlayer !== undefined)

    let canJoin = $derived.by(() => {
        if (isOwnedByMe) {
            return false
        }

        if (isMine && myPlayer?.status === PlayerStatus.Reserved) {
            return true
        }

        return (
            game.isPublic &&
            !isMine &&
            game.status === GameStatus.WaitingForPlayers &&
            openSeats > 0
        )
    })

    let canDecline = $derived(
        (game.status === GameStatus.WaitingForPlayers ||
            game.status === GameStatus.WaitingToStart) &&
            !isOwnedByMe &&
            isMine &&
            myPlayer?.status === PlayerStatus.Reserved
    )

    let canLeave = $derived(
        (game.status === GameStatus.WaitingForPlayers ||
            game.status === GameStatus.WaitingToStart) &&
            !isOwnedByMe &&
            isMine &&
            myPlayer?.status === PlayerStatus.Joined
    )

    let canEdit = $derived(
        isOwnedByMe &&
            !game.parentId &&
            (game.status === GameStatus.WaitingForPlayers ||
                game.status === GameStatus.WaitingToStart)
    )

    let canStart = $derived(isOwnedByMe && game.status === GameStatus.WaitingToStart)
    let canPlay = $derived(isMine && game.status === GameStatus.Started)
    let canWatch = $derived(!isMine && game.status === GameStatus.Started)
    let canRevisit = $derived(game.status === GameStatus.Finished)
    let canDelete = $derived(isOwnedByMe || authorizationService.isAdmin)

    let confirmDelete = $state(false)

    let waitingToStart = $derived(
        (game.status === GameStatus.WaitingForPlayers ||
            game.status === GameStatus.WaitingToStart) &&
            !isOwnedByMe &&
            isMine &&
            myPlayer?.status === PlayerStatus.Joined
    )

    let isMyTurn = $derived(
        game.status === GameStatus.Started &&
            game.activePlayerIds?.find((id) => id === myPlayer?.id) != undefined
    )

    let openSeats = $derived(
        game.players.reduce((acc, player) => acc + (player.status === PlayerStatus.Open ? 1 : 0), 0)
    )
    let totalSeats = $derived(game.players.length)
    let explorations = $derived(gameService.getExplorations(game.id))

    let seed = $derived.by(() => {
        if (!authorizationService.isAdmin) {
            return undefined
        }

        return game.seed
    })

    function toggleExpand() {
        if (!canToggle) {
            return
        }
        isExpanded = !isExpanded
    }

    async function joinGame(event: Event) {
        event.stopPropagation()
        game = await gameService.joinGame(game.id)
        onjoin?.(game)
    }

    async function declineGame(event: Event) {
        event.stopPropagation()
        game = await gameService.declineGame(game.id)
        ondecline?.(game)
    }

    async function startGame(event: Event) {
        event.stopPropagation()
        game = await gameService.startGame(game)
        await goto(`/game/${game.id}`)
        onstart?.(game)
    }

    function editGame(event: Event) {
        event.stopPropagation()
        editing = true
    }

    async function deleteGame(event: Event) {
        event.stopPropagation()
        confirmDelete = true
    }

    function onDeleteCancel() {
        confirmDelete = false
    }

    async function onDeleteConfirm() {
        confirmDelete = false
        await gameService.deleteGame(game.id)
        ondelete?.(game)
    }

    async function playGame(event: Event) {
        event.stopPropagation()
        await goto(`/game/${game.id}`)
    }

    function isActive(playerId: string) {
        return game.activePlayerIds?.includes(playerId)
    }

    function isWinner(playerId: string) {
        return game.winningPlayerIds?.includes(playerId)
    }

    function activePlayerText() {
        if (isMyTurn) {
            return 'You'
        }
        const activePlayerIds = game.activePlayerIds ?? []
        if (activePlayerIds.length === 1) {
            return game.players.find((p) => p.id === activePlayerIds[0])?.name
        } else {
            return `Multiple players`
        }
    }

    function gameResultText() {
        switch (game.result) {
            case GameResult.Win:
                return 'Winner'
            case GameResult.Draw:
                return 'Tied'
            case GameResult.Abandoned:
                return 'Abandoned'
            default:
                return 'Winner'
        }
    }

    function gameResultPlayerText() {
        if (game.winningPlayerIds.includes(myPlayer?.id ?? '')) {
            return `You${game.winningPlayerIds.length > 1 ? ' and others' : ''}`
        }
        if (game.winningPlayerIds.length === 0) {
            return '-'
        } else if (game.winningPlayerIds.length === 1) {
            const winningPlayerIds = game.winningPlayerIds ?? []
            return game.players.find((p) => p.id === winningPlayerIds[0])?.name
        } else {
            return `See below`
        }
    }

    let displayableConfigs: Record<string, string> = $derived.by(() => {
        const title = libraryService.getTitle(game.typeId)
        if (!title || !game.config) {
            return {}
        }
        if (title.configurator?.options.length === 0 || Object.keys(game.config).length === 0) {
            return {}
        }
        const configs: Record<string, string> = {}
        if (game.config) {
            for (const [key, value] of Object.entries(game.config)) {
                const option = title.configurator?.options.find((opt) => opt.id === key)
                if (!option) {
                    continue
                }
                if (value === option.default && !option.alwaysShow) {
                    continue
                }

                let displayValue = value
                if (option.type === ConfigOptionType.Boolean) {
                    displayValue = value ? 'Yes' : 'No'
                } else if (option.type === ConfigOptionType.List) {
                    const matchedOption = option.options.find((opt) => opt.value === value)
                    displayValue = matchedOption ? matchedOption.name : value
                }

                configs[option.name] = String(displayValue)
            }
        }
        return configs
    })
</script>

<Card
    onclick={toggleExpand}
    class="min-w-[310px] mx-2 mb-1 bg-[#0d56ad] dark:border-gray-800 border-4 rounded-md overflow-hidden shadow-none"
    size="sm"
>
    <div class="flex flex-col">
        <div class="flex flex-row">
            <div class="shrink-0">
                <img
                    class="h-[80px]"
                    alt="cover thumbnail"
                    src={libraryService.getThumbnailForTitle(game.typeId)}
                />
            </div>
            <div class="pl-4 pr-2 py-0 w-full">
                <div class="flex flex-col justify-between h-full">
                    <div class="flex flex-row justify-between items-start pb-2">
                        <div class="flex flex-col justify-end items-start">
                            <h1 class="text-lg font-light text-left dark:text-gray-200 leading-5">
                                {game.name}
                            </h1>
                        </div>
                        {#if !isExpanded}
                            <div class="ms-2 text-nowrap">
                                {#if canJoin}
                                    <Button
                                        size="xs"
                                        color="green"
                                        class="h-[20px]"
                                        onclick={joinGame}>Join</Button
                                    >
                                {:else if canStart}
                                    <Button
                                        size="xs"
                                        color="primary"
                                        class="h-[20px]"
                                        onclick={startGame}>Start</Button
                                    >
                                {:else if canEdit}
                                    <Button
                                        size="xs"
                                        color="blue"
                                        class="h-[20px]"
                                        onclick={editGame}>Edit</Button
                                    >
                                {:else if canPlay || canWatch}
                                    <Button
                                        size="xs"
                                        color={isMyTurn ? 'yellow' : 'primary'}
                                        class="h-[20px]"
                                        onclick={playGame}
                                        >{isMyTurn
                                            ? 'Your Turn'
                                            : canPlay
                                              ? 'Enter'
                                              : 'Watch'}</Button
                                    >
                                {:else if canRevisit}
                                    <Button
                                        size="xs"
                                        color="light"
                                        class="h-[20px] dark:text-gray-200"
                                        onclick={playGame}>Revisit</Button
                                    >
                                {/if}
                            </div>
                            {#if waitingToStart}
                                <div class="text-xs text-right text-gray-400">
                                    Waiting<br />to start
                                </div>
                            {/if}
                        {/if}
                    </div>
                    <div class="flex flex-row justify-between items-start text-white">
                        {#if game.status === GameStatus.Started}
                            <div class="flex flex-col justify-start items-start">
                                <div
                                    class="text-gray-600"
                                    style="font-size:.7rem; line-height:.8rem"
                                >
                                    Active Player
                                </div>
                                <div class="text-xs text-orange-400">
                                    {activePlayerText()}
                                </div>
                            </div>
                        {:else if game.status === GameStatus.Finished}
                            <div class="flex flex-col justify-start items-start">
                                <div
                                    class="text-gray-600"
                                    style="font-size:.7rem; line-height:.8rem"
                                >
                                    {gameResultText()}
                                </div>
                                <div class="text-xs text-blue-400">
                                    {gameResultPlayerText()}
                                </div>
                            </div>
                        {:else}
                            <div class="flex flex-col justify-start items-start">
                                <div
                                    class="text-gray-600"
                                    style="font-size:.7rem; line-height:.8rem"
                                >
                                    {libraryService.getNameForTitle(game.typeId)}
                                </div>
                                <div class="text-xs text-gray-400">
                                    {totalSeats} player
                                </div>
                            </div>
                        {/if}
                        {#if game.hotseat}
                            <div class="flex flex-col justify-center items-end">
                                <div
                                    class="text-gray-600"
                                    style="font-size:.7rem; line-height:.8rem"
                                >
                                    Mode
                                </div>
                                <div class="text-xs text-green-400">Hotseat</div>
                            </div>
                        {:else if game.status === GameStatus.Started && game.lastActionAt}
                            <div class="flex flex-col justify-center items-end">
                                <div
                                    class="text-gray-600"
                                    style="font-size:.7rem; line-height:.8rem"
                                >
                                    Last Action
                                </div>
                                <div class="text-xs text-gray-400">
                                    {timeAgo.format(new Date(game.lastActionAt))}
                                </div>
                            </div>
                        {:else if game.status === GameStatus.Finished}
                            <div class="flex flex-col justify-center items-end">
                                <div
                                    class="text-gray-600"
                                    style="font-size:.7rem; line-height:.8rem"
                                >
                                    Finished
                                </div>
                                {#if game.finishedAt}
                                    <div class="text-xs text-gray-400">
                                        {timeAgo.format(new Date(game.finishedAt))}
                                    </div>
                                {/if}
                            </div>
                        {:else}
                            <div class="flex flex-col justify-center items-end">
                                <div
                                    class="text-gray-600"
                                    style="font-size:.7rem; line-height:.8rem"
                                >
                                    Open Seats
                                </div>
                                <div class="text-xs text-gray-400">
                                    {#if openSeats === 0}
                                        None
                                    {:else}
                                        {openSeats}/{totalSeats}
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
        {#if Object.keys(displayableConfigs).length > 0}
            <div class="p-2 flex flex-col text-xs text-gray-400">
                <Hr class="mt-1 mb-1" />
                {#each Object.entries(displayableConfigs) as [key, value]}
                    <div class="flex flex-row justify-between">
                        <div>{key}</div>
                        <div>{value}</div>
                    </div>
                {/each}
                <Hr class="mt-1 mb-1" />
            </div>
        {/if}
        {#if isExpanded}
            <div
                class="pt-4 ps-4 pe-4 text-gray-400"
                in:slide={{ axis: 'y', duration: 400 }}
                out:slide={{ axis: 'y', duration: 400 }}
            >
                <div in:fade={{ duration: 400 }} out:fade={{ duration: 75 }}>
                    <div class="flex flex-col text-sm">
                        <div class="flex flex-row justify-between">
                            <div class="text-xs font-semibold">PLAYERS</div>
                        </div>
                        <Hr class="mt-1 mb-1" />
                        {#each sortedPlayers as player (player.id)}
                            <div class="flex flex-row justify-between">
                                <div
                                    class={isActive(player.id)
                                        ? 'text-orange-400'
                                        : isWinner(player.id)
                                          ? 'text-blue-400'
                                          : ''}
                                >
                                    {player.name ?? ''}
                                </div>
                                <div>
                                    {game.hotseat
                                        ? 'local'
                                        : playerStatusDisplay(player, game.ownerId)}
                                </div>
                            </div>
                        {/each}
                    </div>
                    {#if explorations.length > 0}
                        <div class="flex flex-col text-sm mt-4">
                            <div class="flex flex-row justify-between">
                                <div class="text-xs font-semibold">EXPLORATIONS</div>
                            </div>
                            <Hr class="mt-1 mb-1" />
                            {#each explorations as exploration (exploration.id)}
                                <div class="flex flex-row justify-between items-center">
                                    <div>
                                        {exploration.name ?? ''}
                                    </div>
                                    <div></div>
                                </div>
                            {/each}
                        </div>
                    {/if}

                    {#if canJoin || canStart || canEdit || canDecline || canLeave || canPlay || canWatch || canRevisit || canDelete}
                        <Hr class="mt-1 mb-1" />
                        <div class="pt-4 pb-0 flex flex-row justify-center items-middle text-white">
                            {#if canDecline}
                                <Button size="xs" color="red" class="mx-2" onclick={declineGame}
                                    >Decline</Button
                                >
                            {/if}
                            {#if canLeave}
                                <Button size="xs" color="red" class="mx-2" onclick={declineGame}
                                    >Leave</Button
                                >
                            {/if}
                            {#if canJoin}
                                <Button size="xs" color="green" class="mx-2" onclick={joinGame}
                                    >Join</Button
                                >
                            {/if}
                            {#if canEdit}
                                <Button size="xs" color="blue" class="mx-2" onclick={editGame}
                                    >Edit Game</Button
                                >
                            {/if}
                            {#if canStart}
                                <Button size="xs" color="primary" class="mx-2" onclick={startGame}
                                    >Start Game</Button
                                >
                            {/if}
                            {#if isMyTurn}
                                <Button size="xs" color="yellow" class="mx-2" onclick={playGame}
                                    >Take Your Turn</Button
                                >
                            {:else if canPlay || canWatch}
                                <Button size="xs" color="primary" class="mx-2" onclick={playGame}
                                    >{canPlay ? 'Play' : 'Watch'}&nbsp;Game</Button
                                >
                            {/if}
                            {#if canRevisit}
                                <Button
                                    size="xs"
                                    color="light"
                                    class="mx-2 dark:text-gray-200"
                                    onclick={playGame}>Revisit</Button
                                >
                            {/if}
                            {#if canDelete}
                                <Button size="xs" color="red" class="mx-2" onclick={deleteGame}
                                    >Delete</Button
                                >
                            {/if}
                        </div>
                    {/if}
                    {#if seed}
                        <div
                            class="mt-4 flex flex-row justify-center items-center text-nowrap text-center mb-1 sm:mb-0 max-w-[320px] dark:text-gray-400 font-mono text-xs overflow-clip text-ellipsis"
                            style=""
                        >
                            <span class="font-semibold">SEED</span>: {seed}
                        </div>
                    {/if}
                    {#if authorizationService.showDebug}
                        <div class="pt-2 text-xs">{game.id}</div>
                    {/if}
                </div>
            </div>
        {/if}

        <div
            class="flex flex-row justify-center items-center text-center dark:text-gray-700 hover:dark:text-gray-200 -mt-1"
        >
            {#if !isExpanded}
                <svg
                    in:fade={{ duration: 75, delay: 400 }}
                    class="w-[30px] h-[30px]"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="none"
                    viewBox="0 0 18 18"
                >
                    <path
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="m8 10 4 4 4-4"
                    ></path>
                </svg>
            {:else}
                <svg
                    in:fade={{ duration: 75, delay: 400 }}
                    class="w-[30px] h-[30px]"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="none"
                    viewBox="0 0 18 18"
                >
                    <path
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="m13 14-4-4-4 4"
                    ></path>
                </svg>
            {/if}
        </div>
    </div></Card
>
{#if confirmDelete}
    <DeleteModal bind:open={confirmDelete} oncancel={onDeleteCancel} onconfirm={onDeleteConfirm} />
{/if}

{#if editing}
    <Modal
        bind:open={editing}
        size="xs"
        autoclose={false}
        class="w-full"
        outsideclose
        dismissable={false}
        onclick={(e) => e.stopPropagation()}
    >
        <GameEditForm
            {game}
            oncancel={() => (editing = false)}
            onsave={(game) => (editing = false)}
        />
    </Modal>
{/if}
