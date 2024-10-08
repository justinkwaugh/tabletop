<script lang="ts">
    import { Card, Hr, Button } from 'flowbite-svelte'
    import { GameStatus, PlayerStatus, type Game, GameResult } from '@tabletop/common'
    import { getContext } from 'svelte'
    import { playerSortValue, playerStatusDisplay } from '$lib/utils/player'
    import type { AppContext } from '$lib/stores/appContext.svelte'
    import { goto } from '$app/navigation'
    import TimeAgo from 'javascript-time-ago'
    import { fade, slide } from 'svelte/transition'
    import DeleteModal from './DeleteModal.svelte'

    const timeAgo = new TimeAgo('en-US')

    let {
        game,
        onedit,
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
        onedit?: (game: Game) => void
        ondelete?: (game: Game) => void
        expanded?: boolean | 'always'
    } = $props()

    let { libraryService, authorizationService, gameService } = getContext(
        'appContext'
    ) as AppContext

    let canToggle = expanded !== 'always'
    let isExpanded = $state(expanded ? true : false)

    let sessionUser = authorizationService.getSessionUser()
    let isOwnedByMe = $derived(sessionUser?.id === game.ownerId)
    let sortedPlayers = $derived(
        game.players.sort(
            (a, b) => playerSortValue(a, game.ownerId) - playerSortValue(b, game.ownerId)
        )
    )

    let myPlayer = $derived(sortedPlayers.find((player) => player.userId === sessionUser?.id))
    let isMine = $derived(myPlayer !== undefined)

    let canJoin = $derived(isMine && myPlayer?.status === PlayerStatus.Reserved)
    let canDecline = $derived(
        (game.status === GameStatus.WaitingForPlayers ||
            game.status === GameStatus.WaitingToStart) &&
            !isOwnedByMe &&
            isMine &&
            myPlayer?.status !== PlayerStatus.Declined
    )
    let canEdit = $derived(
        isOwnedByMe &&
            (game.status === GameStatus.WaitingForPlayers ||
                game.status === GameStatus.WaitingToStart)
    )

    let canStart = $derived(isOwnedByMe && game.status === GameStatus.WaitingToStart)
    let canPlay = $derived(isMine && game.status === GameStatus.Started)
    let canWatch = $derived(!isMine && game.status === GameStatus.Started)
    let canRevisit = $derived(game.status === GameStatus.Finished)
    let canDelete = $derived(isOwnedByMe)

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
        onedit?.(game)
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
</script>

<Card
    on:click={toggleExpand}
    class="mx-2 mb-1 bg-[#0d56ad] dark:border-gray-800 border-4 rounded-md overflow-hidden shadow-none"
    padding="none"
    size="sm"
>
    <div class="flex flex-col">
        <div class="flex flex-row">
            <div>
                <img
                    class="w-[80px] h-[80px]"
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

                        {#if game.status === GameStatus.Started && game.lastActionAt}
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
        {#if isExpanded}
            <div
                class="pt-4 ps-4 pe-4"
                in:slide={{ axis: 'y', duration: 400 }}
                out:slide={{ axis: 'y', duration: 400 }}
            >
                <div in:fade={{ duration: 400 }} out:fade={{ duration: 75 }}>
                    <div class="flex flex-col text-sm">
                        <div class="flex flex-row justify-between">
                            <div class="text-xs font-semibold">PLAYERS</div>
                        </div>
                        <Hr hrClass="mt-1 mb-1" />
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
                                <div>{playerStatusDisplay(player, game.ownerId)}</div>
                            </div>
                        {/each}
                    </div>

                    {#if canJoin || canStart || canEdit || canDecline || canPlay || canWatch || canRevisit || canDelete}
                        <Hr hrClass="mt-2 mb-0" />
                        <div class="pt-4 pb-0 flex flex-row justify-center items-middle text-white">
                            {#if canDecline}
                                <Button size="xs" color="red" class="mx-2" onclick={declineGame}
                                    >Decline</Button
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
