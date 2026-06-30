<script lang="ts">
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import TimeAgo from 'javascript-time-ago'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import { PlayerName } from '@tabletop/frontend-components'
    import type { GameAction } from '@tabletop/common'
    import { isEndRoundEvent, isSelectTile } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { getDescriptionForAction } from '$lib/utils/actionDescriptions.js'

    const timeAgo = new TimeAgo('en-US')
    const session = getGameSession()

    const reversedActions = $derived.by(() =>
        session.actions
            .filter((a: GameAction) => !isSelectTile(a))
            .filter((a: GameAction) => !!a.playerId || isEndRoundEvent(a))
            .toReversed()
            .toSorted(
                (a: GameAction, b: GameAction) =>
                    (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
            )
    )
</script>

<div class="rounded-lg border border-gray-700 bg-gray-900/80 p-3 min-w-52">
    <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">History</p>
    <Timeline class="ms-1 text-left">
        {#if session.game?.finishedAt}
            <TimelineItem title="" class="mb-4" date={timeAgo.format(session.game.finishedAt)}>
                <p class="text-sm text-gray-200">The game ended.</p>
            </TimelineItem>
        {/if}
        {#each reversedActions as action (action.id)}
            <div
                in:fade={{ duration: 200, easing: quartIn }}
                out:fade={{ duration: 50 }}
                animate:flip={{ duration: 100 }}
            >
                <TimelineItem title="" class="mb-4" date={action.createdAt ? timeAgo.format(action.createdAt) : ''}>
                    <p class="text-sm text-gray-200">
                        {#if action.playerId}
                            <PlayerName playerId={action.playerId} />
                        {/if}
                        {getDescriptionForAction(action, {
                            allActions: session.actions,
                            playerName: (id) => session.game?.players.find(p => p.id === id)?.name ?? id
                        })}
                    </p>
                </TimelineItem>
            </div>
        {/each}
        <TimelineItem title="" class="mb-4" date={session.game?.createdAt ? timeAgo.format(session.game.createdAt) : ''}>
            <p class="text-sm text-gray-200">The game started.</p>
        </TimelineItem>
    </Timeline>
</div>
