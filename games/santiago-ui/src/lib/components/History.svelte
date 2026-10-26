<script lang="ts">
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import { isCallGameAction, type GameAction } from '@tabletop/common'
    import { CalledGameDescription, createTimeAgo } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { getDescriptionForAction, isShownInHistory } from '$lib/utils/actionDescriptions.js'
    import PlayerNameChip from './PlayerNameChip.svelte'

    const timeAgo = createTimeAgo()
    const session = getGameSession()

    const reversedActions = $derived.by(() =>
        session.actions
            .filter(isShownInHistory)
            .toReversed()
            .toSorted(
                (a: GameAction, b: GameAction) =>
                    (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
            )
    )
</script>

{#snippet timelineDot()}
    <div
        aria-hidden="true"
        class="absolute w-3 h-3 bg-stone-800 rounded-full mt-1.5 -start-1.5 border border-stone-500"
    ></div>
{/snippet}

<div
    class="santiago-history paper-texture rounded-lg border border-stone-700 bg-stone-900/80 p-3 min-w-52"
>
    <p class="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">History</p>
    <Timeline class="ms-2 text-left border-stone-500 dark:border-stone-500">
        {#if session.game?.finishedAt}
            {@render timelineDot()}
            <TimelineItem
                title=""
                class="timeline-item mb-4"
                timeClass="text-stone-400 dark:text-stone-400"
                date={timeAgo.format(session.game.finishedAt)}
            >
                <p class="text-sm text-stone-200">The game ended.</p>
            </TimelineItem>
        {/if}
        {#each reversedActions as action (action.id)}
            <div
                in:fade={{ duration: 200, easing: quartIn }}
                out:fade={{ duration: 50 }}
                animate:flip={{ duration: 100 }}
            >
                {@render timelineDot()}
                <TimelineItem
                    title=""
                    class="timeline-item mb-4"
                    timeClass="text-stone-400 dark:text-stone-400"
                    date={action.createdAt ? timeAgo.format(action.createdAt) : ''}
                >
                    <p class="text-sm text-stone-200">
                        {#if isCallGameAction(action)}
                            <CalledGameDescription {action} />
                        {:else}
                            {#if action.playerId}
                                <PlayerNameChip playerId={action.playerId} />
                            {/if}
                            {#each getDescriptionForAction( action, { allActions: session.actions } ) as part, i (i)}
                                {#if typeof part === 'string'}
                                    {part}
                                {:else}
                                    <PlayerNameChip playerId={part.playerId} />
                                {/if}
                            {/each}
                        {/if}
                    </p>
                </TimelineItem>
            </div>
        {/each}
        {@render timelineDot()}
        <TimelineItem
            title=""
            class="timeline-item mb-4"
            timeClass="text-stone-400 dark:text-stone-400"
            date={session.game?.createdAt ? timeAgo.format(session.game.createdAt) : ''}
        >
            <p class="text-sm text-stone-200">The game started.</p>
        </TimelineItem>
    </Timeline>
</div>

<style>
    .santiago-history :global(.timeline-item > div) {
        display: none;
    }
</style>
