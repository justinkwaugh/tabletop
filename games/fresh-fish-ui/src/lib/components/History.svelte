<script lang="ts">
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import { getContext } from 'svelte'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import {
        ActionType,
        isDrawTile,
        isEndAuction,
        isMarketTile,
        isPlaceDisk,
        isPlaceMarket,
        isPlaceStall,
        isStallTile,
        Tile
    } from '@tabletop/fresh-fish'
    import type { GameAction } from '@tabletop/common'
    import TimeAgo from 'javascript-time-ago'
    import { EndAuction } from '@tabletop/fresh-fish'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import { GameSessionMode } from '@tabletop/frontend-components'

    const timeAgo = new TimeAgo('en-US')

    let gameSession = getContext('gameSession') as FreshFishGameSession
    let unhighlightTimeout: ReturnType<typeof setTimeout>

    let reversedActions = $derived.by(() => {
        let actions = gameSession.actions

        if (gameSession.mode === GameSessionMode.History) {
            actions = actions.filter(
                (action) => (action.index ?? 0) <= gameSession.currentHistoryIndex
            )
        }

        const reversed = actions
            .filter(
                (action) =>
                    ![ActionType.PlaceBid as string, ActionType.StartAuction as string].includes(
                        action.type
                    ) && !(isDrawTile(action) && isMarketTile(action.metadata?.chosenTile))
            )
            .reverse()
            .toSorted(
                (a, b) =>
                    (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now())
            )
        return reversed
    })

    function getDescriptionForAction(action: GameAction) {
        switch (true) {
            case isDrawTile(action):
                let tileDesc = action.metadata?.chosenTile
                    ? gameSession.getTileName(action.metadata.chosenTile)
                    : ''
                return `drew a ${tileDesc} tile${isStallTile(action.metadata?.chosenTile) ? ' and put it up for auction' : ''}`
            case isPlaceDisk(action):
                return 'placed a disk on the board'
            case isPlaceMarket(action):
                return 'drew a market tile and placed it on the board'
            case isPlaceStall(action):
                if (action.coords) {
                    return `placed a ${gameSession.getGoodsName(action.goodsType)} stall on the board`
                } else {
                    return `had to place a ${gameSession.getGoodsName(action.goodsType)} stall, but did not have a reserved location so the stall was discarded`
                }
            case isEndAuction(action):
                return 'The auction has ended:'
            default:
                return action.type
        }
    }

    function stepBackward() {
        gameSession.stepBackward()
    }

    function stepForward() {
        gameSession.stepForward()
    }

    function highlight(action: GameAction) {
        if (
            (isPlaceDisk(action) || isPlaceMarket(action) || isPlaceStall(action)) &&
            action.coords !== undefined
        ) {
            if (unhighlightTimeout) {
                clearTimeout(unhighlightTimeout)
            }

            gameSession.highlightCoords(action.coords)
        }
    }

    function unhighlight() {
        if (unhighlightTimeout) {
            clearTimeout(unhighlightTimeout)
        }
        unhighlightTimeout = setTimeout(() => {
            gameSession.clearHighlightedCoords()
        }, 250)
    }
</script>

<div
    class="rounded-lg border border-gray-700 text-center p-2 h-full flex flex-col justify-center items-left overflow-hidden min-h-[300px]"
>
    <h1 class="text-xl font-light text-white pb-1">History</h1>
    <div class="flex flex-row justify-center items-center space-x-2">
        <button onclick={() => gameSession.gotoAction(-1)}
            ><svg
                class="w-[25px] h-[25px] text-gray-800 {gameSession.actions.length === 0 ||
                gameSession.currentHistoryIndex === -1
                    ? 'dark:text-gray-700'
                    : 'dark:text-white'}"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    fill-rule="evenodd"
                    d="M7 6a1 1 0 0 1 2 0v4l6.4-4.8A1 1 0 0 1 17 6v12a1 1 0 0 1-1.6.8L9 14v4a1 1 0 1 1-2 0V6Z"
                    clip-rule="evenodd"
                ></path>
            </svg>
        </button>
        <button class="text-white" onclick={() => stepBackward()}
            ><svg
                class="w-[24px] h-[24px] text-gray-800 {gameSession.actions.length === 0 ||
                gameSession.currentHistoryIndex === -1
                    ? 'dark:text-gray-700'
                    : 'dark:text-white'}"
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
                    d="m15 19-7-7 7-7"
                ></path>
            </svg>
        </button>
        <button
            onclick={() => gameSession.playHistory()}
            class={gameSession.playingHistory ? 'hidden' : ''}
            ><svg
                class="w-[25px] h-[25px] text-gray-800 {gameSession.actions.length === 0
                    ? 'dark:text-gray-700'
                    : 'dark:text-white'}"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    fill-rule="evenodd"
                    d="M8.6 5.2A1 1 0 0 0 7 6v12a1 1 0 0 0 1.6.8l8-6a1 1 0 0 0 0-1.6l-8-6Z"
                    clip-rule="evenodd"
                ></path>
            </svg>
        </button>
        <button
            onclick={() => gameSession.stopHistoryPlayback()}
            class={!gameSession.playingHistory ? 'hidden' : ''}
        >
            <svg
                class="w-[25px] h-[25px] text-gray-800 dark:text-white"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    fill-rule="evenodd"
                    d="M8 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H8Zm7 0a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1Z"
                    clip-rule="evenodd"
                ></path>
            </svg>
        </button>
        <button class="text-white" onclick={() => stepForward()}
            ><svg
                class="w-[24px] h-[24px] text-gray-800 {gameSession.mode !== GameSessionMode.History
                    ? 'dark:text-gray-700'
                    : 'dark:text-white'}"
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
                    d="m9 5 7 7-7 7"
                ></path>
            </svg>
        </button>
        <button onclick={() => gameSession.gotoAction(gameSession.actions.length - 1)}>
            <svg
                class="w-[25px] h-[25px] text-gray-800 {gameSession.mode !== GameSessionMode.History
                    ? 'dark:text-gray-700'
                    : 'dark:text-white'}"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    fill-rule="evenodd"
                    d="M17 6a1 1 0 1 0-2 0v4L8.6 5.2A1 1 0 0 0 7 6v12a1 1 0 0 0 1.6.8L15 14v4a1 1 0 1 0 2 0V6Z"
                    clip-rule="evenodd"
                ></path>
            </svg>
        </button>
    </div>
    <div class="overflow-scroll h-full">
        <Timeline class="ms-1">
            {#if gameSession.game.finishedAt && gameSession.mode !== GameSessionMode.History}
                <TimelineItem
                    classTime=""
                    classLi="mb-5 text-left"
                    date={timeAgo.format(gameSession.game.finishedAt)}
                >
                    <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                        The game has ended.
                    </p>
                </TimelineItem>
            {/if}
            {#each reversedActions as action, i (action.id)}
                <div
                    role="button"
                    tabindex={-1}
                    onfocus={() => {}}
                    onkeypress={() => {}}
                    in:fade={{ duration: 200, easing: quartIn }}
                    out:fade={{ duration: 50 }}
                    animate:flip={{ duration: 100 }}
                    onmouseover={() => highlight(action)}
                    onmouseleave={() => unhighlight()}
                >
                    <TimelineItem
                        classTime=""
                        classLi="mb-5 text-left"
                        date={action.createdAt ? timeAgo.format(action.createdAt) : 'sometime'}
                    >
                        <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                            {#if action.playerId}
                                <span
                                    class="rounded px-2 {gameSession.getPlayerBgColor(
                                        action.playerId
                                    )} font-medium {gameSession.getPlayerTextColor(
                                        action.playerId
                                    )}">{gameSession.getPlayerName(action.playerId)}</span
                                >
                            {/if}
                            {getDescriptionForAction(action)}
                        </p>
                        {#if action.type === ActionType.EndAuction}
                            <div class="p-2 ms-4 text-sm">
                                <div
                                    class="text-xs text-white flex flex-col justify-center items-left space-y-1"
                                >
                                    {#each (action as EndAuction).metadata?.participants ?? [] as participant}
                                        <div>
                                            <span
                                                class="rounded px-2 {gameSession.getPlayerBgColor(
                                                    participant.playerId
                                                )} font-medium {gameSession.getPlayerTextColor(
                                                    participant.playerId
                                                )}"
                                                >{gameSession.getPlayerName(
                                                    participant.playerId
                                                )}</span
                                            >
                                            bid ${participant.bid}
                                        </div>
                                    {/each}
                                </div>
                            </div>
                            <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                                <span
                                    class="rounded px-2 {gameSession.getPlayerBgColor(
                                        (action as EndAuction).winnerId
                                    )} font-medium {gameSession.getPlayerTextColor(
                                        (action as EndAuction).winnerId
                                    )}"
                                    >{gameSession.getPlayerName(
                                        (action as EndAuction).winnerId
                                    )}</span
                                >
                                won the auction with a bid of ${(action as EndAuction).highBid}
                            </p>
                        {/if}
                    </TimelineItem>
                </div>
            {/each}
            <TimelineItem
                classTime=""
                classLi="mb-5 text-left"
                date={timeAgo.format(gameSession.game.createdAt)}
            >
                <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                    The game was started
                </p>
            </TimelineItem>
        </Timeline>
    </div>
</div>
