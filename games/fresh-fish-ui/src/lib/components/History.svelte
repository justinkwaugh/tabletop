<script lang="ts">
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import { getContext } from 'svelte'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import { ActionType, isDrawTile, isEndAuction, isMarketTile } from '@tabletop/fresh-fish'
    import type { GameAction } from '@tabletop/common'
    import TimeAgo from 'javascript-time-ago'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import { GameSessionMode, PlayerName } from '@tabletop/frontend-components'
    import { getDescriptionForAction } from '$lib/utils/actionDescriptions.js'
    import AuctionResults from './AuctionResults.svelte'

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
            .toReversed()
            .toSorted(
                (a, b) =>
                    (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now())
            )
        return reversed
    })

    function highlight(action: GameAction) {
        if (gameSession.mode === GameSessionMode.History) {
            return
        }
        if (unhighlightTimeout) {
            clearTimeout(unhighlightTimeout)
        }
        gameSession.setHighlightedCoordsForAction(action)
    }

    function unhighlight() {
        if (gameSession.mode === GameSessionMode.History) {
            return
        }
        if (unhighlightTimeout) {
            clearTimeout(unhighlightTimeout)
        }
        unhighlightTimeout = setTimeout(() => {
            gameSession.clearHighlightedCoords()
        }, 250)
    }
</script>

<div
    class="rounded-lg border border-gray-700 text-center p-2 h-full flex flex-col justify-start items-left overflow-hidden min-h-[300px]"
>
    <div class="overflow-auto h-full">
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
                                <PlayerName playerId={action.playerId} />
                            {/if}
                            {getDescriptionForAction(action)}
                        </p>
                        {#if isEndAuction(action)}
                            <AuctionResults {action} />
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
