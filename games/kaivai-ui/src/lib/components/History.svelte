<script lang="ts">
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import {
        ActionType,
        isCelebrate,
        isChooseScoringIsland,
        isDeliver,
        isFish,
        isMove,
        isMoveGod,
        isPass,
        isScoreHuts,
        isScoreIsland,
        PassReason
    } from '@tabletop/kaivai'
    import type { GameAction } from '@tabletop/common'
    import TimeAgo from 'javascript-time-ago'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import { GameSessionMode, PlayerName } from '@tabletop/frontend-components'
    import { getHistoryDescriptionForAction } from '$lib/utils/historyDescriptions'
    import FishingResults from './FishingResults.svelte'
    import IslandScoringResults from './IslandScoringResults.svelte'
    import HutScoringResults from './HutScoringResults.svelte'
    import CelebrateResults from './CelebrateResults.svelte'
    import MoveGodResults from './MoveGodResults.svelte'
    import {
        HistoryItemType,
        isActionHistoryItem,
        isRoundStartHistoryItem,
        type ActionHistoryItem,
        type HistoryItem,
        type RoundStartHistoryItem
    } from '$lib/model/HistoryItem.svelte.js'

    const timeAgo = new TimeAgo('en-US')

    let gameSession = getContext('gameSession') as KaivaiGameSession
    let unhighlightTimeout: ReturnType<typeof setTimeout>

    let filteredActions = $derived.by(() => {
        return gameSession.actions.filter((action) => {
            if (
                gameSession.mode === GameSessionMode.History &&
                (action.index ?? 0) > gameSession.currentHistoryIndex
            ) {
                return false
            }

            return (
                action.type !== ActionType.PlaceScoringBid &&
                (!isPass(action) || action.metadata?.reason === PassReason.DoneActions) &&
                !isChooseScoringIsland(action)
            )
        })
    })

    let roundIndices = $derived.by(() => {
        let roundIndices: Record<number, number> = []
        for (const round of gameSession.gameState.rounds.series) {
            roundIndices[round.start - 1] = round.number
        }
        return roundIndices
    })

    let historyItems = $derived.by(() => {
        const items = []
        items.push(<HistoryItem>{
            type: HistoryItemType.Default,
            id: `${gameSession.game.id}-start`,
            date: gameSession.game.createdAt,
            description: 'The game was started'
        })
        for (const action of filteredActions) {
            const roundStartNumber = roundIndices[action.index ?? 0]
            if (roundStartNumber !== undefined) {
                items.push(<RoundStartHistoryItem>{
                    type: HistoryItemType.RoundStart,
                    id: `${gameSession.game.id}-round-${roundStartNumber}`,
                    round: roundStartNumber
                })
            }
            items.push(<ActionHistoryItem>{
                type: HistoryItemType.Action,
                id: action.id,
                date: action.createdAt ?? new Date(),
                action: action
            })
        }
        if (gameSession.game.finishedAt) {
            items.push(<HistoryItem>{
                type: HistoryItemType.Default,
                id: `${gameSession.game.id}-end`,
                date: gameSession.game.finishedAt,
                description: 'The game has ended'
            })
        }

        return items.reverse()
    })
</script>

{#snippet actionHistoryItem(action: GameAction)}
    <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
        {#if action.playerId}
            <PlayerName playerId={action.playerId} />
        {/if}
        {getHistoryDescriptionForAction(
            action,
            action.playerId === gameSession.myPlayer?.id
        )}{#if isMove(action) && action.metadata?.playerSunk}
            sunk <PlayerName playerId={action.metadata.playerSunk} possessive={true} /> boat for a loss
            of {action.metadata.gloryLost} glory
        {/if}{#if isDeliver(action) && (action.metadata?.numSold ?? 0) > 0}, selling {action
                .metadata?.numSold} fish for {action.metadata?.earnings}
        {/if}
        {#if isFish(action)}
            <FishingResults {action} justify={'left'} />
        {/if}
        {#if isScoreIsland(action)}
            <IslandScoringResults {action} history={true} />
        {/if}
        {#if isScoreHuts(action)}
            <HutScoringResults {action} justify={'left'} />
        {/if}
        {#if isCelebrate(action)}
            <CelebrateResults {action} justify={'left'} />
        {/if}
        {#if isMoveGod(action)}
            <MoveGodResults {action} justify={'left'} />
        {/if}
    </p>
{/snippet}

{#snippet defaultHistoryItem(description?: string)}
    <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
        {description}
    </p>
{/snippet}

{#snippet roundStartItem(roundNumber: number)}
    <div class="flex flex-row justify-center items-center">
        <p class="dark:text-[#cabb7a] mt-1 text-center text-2xl font-normal kaivai-font">
            {'\u2191'} ROUND {roundNumber} STARTED {'\u2191'}
        </p>
    </div>
{/snippet}

<div
    class="rounded-lg border-2 border-[#634a11] text-center p-2 h-full flex flex-col justify-start items-left overflow-hidden bg-[#302408]"
>
    <div class="overflow-auto h-full">
        <Timeline class="ms-1 text-left dark:border-[#cabb7a]">
            {#each historyItems as historyItem (historyItem.id)}
                <div
                    in:fade={{ duration: 200, easing: quartIn }}
                    out:fade={{ duration: 50 }}
                    animate:flip={{ duration: 100 }}
                >
                    <TimelineItem
                        timeClass="dark:text-[#8d794d]"
                        classes={{
                            div: historyItem.date
                                ? 'dark:bg-[#cabb7a] border-[#cabb7a]'
                                : 'dark:bg-transparent border-0'
                        }}
                        title=""
                        class="mb-5"
                        date={historyItem.date ? timeAgo.format(historyItem.date) : ''}
                    >
                        {#if historyItem.type === HistoryItemType.Default}
                            {@render defaultHistoryItem(historyItem.description)}
                        {:else if isActionHistoryItem(historyItem)}
                            {@render actionHistoryItem(historyItem.action)}
                        {:else if isRoundStartHistoryItem(historyItem)}
                            {@render roundStartItem(historyItem.round)}
                        {/if}
                    </TimelineItem>
                </div>
            {/each}
        </Timeline>
    </div>
</div>
