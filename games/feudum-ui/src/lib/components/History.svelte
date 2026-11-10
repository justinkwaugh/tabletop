<script lang="ts">
    import { tick } from 'svelte'
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import { fade } from 'svelte/transition'
    import { quartIn } from 'svelte/easing'
    import { createTimeAgo } from '@tabletop/frontend-components'
    import ActionDescription from './ActionDescription.svelte'
    import LogPlayerName from './LogPlayerName.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { EpochNames } from '$lib/model/tileName.js'
    import {
        isHistoryGroup,
        linedActions,
        type HistoryEntry,
        type HistoryGroup,
        type HistoryGroupKind
    } from '$lib/utils/actionAggregator.js'

    const timeAgo = createTimeAgo()

    let gameSession = getGameSession()
    let log = $derived(gameSession.historyLog)
    let scroller: HTMLDivElement | undefined = $state()

    /** Newest first, each interstitial under the entries it opens (as Indonesia's are). */
    let entries = $derived(log.entries.toReversed())
    let finished = $derived(
        gameSession.game.finishedAt && (!gameSession.isViewingHistory || log.replaying)
    )

    const Titles: Readonly<Partial<Record<HistoryGroupKind, string>>> = {
        hands: 'Hand selection',
        nourishing: 'Nourishing',
        progress: 'Progress roll',
        dawn: 'Dawn'
    }

    const JumpLabels: Readonly<Partial<Record<HistoryEntry['kind'], string>>> = {
        round: 'Show the table as this round began',
        turn: 'Show the table as this turn ended',
        dawn: 'Show the table as this dawn ended'
    }

    function dividerText(entry: HistoryEntry): string {
        if (entry.kind === 'epoch') {
            return `Epoch ${EpochNames[entry.epoch]}`
        }
        return entry.kind === 'round' ? `Round ${entry.round}` : ''
    }

    function when(group: HistoryGroup): string {
        const at = group.actions.findLast(({ createdAt }) => createdAt)?.createdAt
        return at ? timeAgo.format(at) : ''
    }

    /** The list follows the displayed state, so what was jumped to is now at the top. */
    async function jump(entry: { readonly jumpIndex?: number }) {
        await log.jump(entry)
        await tick()
        scroller?.scrollTo({ top: 0 })
    }
</script>

{#snippet jumpButton(entry: HistoryEntry & { readonly jumpIndex?: number })}
    {#if entry.jumpIndex !== undefined}
        <button
            type="button"
            class="history-action"
            data-history-jump={entry.jumpIndex}
            aria-label={JumpLabels[entry.kind]}
            title={JumpLabels[entry.kind]}
            disabled={!log.available}
            onclick={() => jump(entry)}
        >
            Jump
        </button>
    {/if}
{/snippet}

<div
    class="rounded-lg border border-feudum-frame text-center p-2 h-full flex flex-col justify-start items-start overflow-hidden min-h-[300px] bg-feudum-surface-raised"
>
    <div class="overflow-auto h-full w-full" bind:this={scroller} data-history-list>
        <Timeline class="ms-2 dark:border-feudum-frame">
            {#if finished}
                <div
                    class="absolute w-3 h-3 bg-feudum-frame rounded-full mt-1.5 -start-1.5 border dark:border-feudum-frame dark:bg-feudum-frame"
                ></div>
                <TimelineItem
                    timeClass="dark:text-feudum-text-muted"
                    title=""
                    class="timeline-item text-left mb-5"
                    date={gameSession.game.finishedAt
                        ? timeAgo.format(gameSession.game.finishedAt)
                        : ''}
                >
                    <p class="mt-1 text-left text-sm text-base font-normal text-feudum-text-muted">
                        The game has ended.
                    </p>
                </TimelineItem>
            {/if}
            {#each entries as entry (entry.id)}
                {#if isHistoryGroup(entry)}
                    <div in:fade={{ duration: 200, easing: quartIn }}>
                        <div
                            class="absolute w-3 h-3 bg-feudum-frame rounded-full mt-1.5 -start-1.5 border dark:border-feudum-frame dark:bg-feudum-frame"
                        ></div>
                        <TimelineItem
                            timeClass="dark:text-feudum-text-muted"
                            title=""
                            class="timeline-item text-left mb-5"
                            date=""
                        >
                            <section
                                data-history-entry={entry.kind}
                                data-first-index={entry.firstIndex}
                                data-last-index={entry.lastIndex}
                                data-replaying={log.replayingEntryId === entry.id ? '' : undefined}
                            >
                                <div
                                    class="flex flex-wrap items-center gap-x-2 text-xs text-feudum-text-muted"
                                >
                                    <span class="me-auto">
                                        {#if entry.kind === 'turn' && entry.playerId}
                                            <span class="font-medium text-feudum-text">
                                                <LogPlayerName
                                                    playerId={entry.playerId}
                                                    viewerId={log.viewerId}
                                                    possessive
                                                /> turn
                                            </span>
                                        {:else if Titles[entry.kind]}
                                            <span class="font-medium text-feudum-text">
                                                {Titles[entry.kind]}
                                            </span>
                                        {/if}
                                        {when(entry)}
                                    </span>
                                    {#if entry.replays}
                                        <button
                                            type="button"
                                            class="history-action"
                                            data-history-replay
                                            aria-label="Replay this on the board"
                                            title="Replay this on the board"
                                            disabled={!log.available}
                                            onclick={() => log.replay(entry)}
                                        >
                                            Replay
                                        </button>
                                    {/if}
                                    {@render jumpButton(entry)}
                                </div>
                                {#each linedActions(entry) as action (action.id)}
                                    <p class="mt-1 text-left text-sm font-normal text-feudum-text">
                                        <ActionDescription {action} viewerId={log.viewerId} />
                                    </p>
                                {/each}
                            </section>
                        </TimelineItem>
                    </div>
                {:else}
                    <div
                        in:fade={{ duration: 200, easing: quartIn }}
                        data-history-divider={entry.kind}
                        class="relative left-[calc(-0.5rem-1px)] mb-4 flex w-[calc(100%+0.5rem+1px)] items-center gap-2 border-y border-feudum-frame bg-feudum-surface px-2 py-1 text-xs font-medium uppercase tracking-wider text-feudum-text-muted"
                    >
                        <span class="flex-1 text-center">↑ {dividerText(entry)} ↑</span>
                        {@render jumpButton(entry)}
                    </div>
                {/if}
            {/each}
            <div
                class="absolute w-3 h-3 bg-feudum-frame rounded-full mt-1.5 -start-1.5 border dark:border-feudum-frame dark:bg-feudum-frame"
            ></div>
            <TimelineItem
                timeClass="dark:text-feudum-text-muted"
                title=""
                class="timeline-item text-left mb-5"
                date={timeAgo.format(gameSession.game.createdAt)}
            >
                <p class="mt-1 text-left text-sm text-base font-normal text-feudum-text">
                    The game was started
                </p>
            </TimelineItem>
        </Timeline>
    </div>
</div>

<!--  fixes a styling issue with timeline-item -->
<style>
    :global(.timeline-item > div) {
        display: none;
    }

    .history-action {
        border-radius: 4px;
        padding: 0 6px;
        font-size: 11px;
        line-height: 18px;
        text-transform: none;
        letter-spacing: normal;
        color: var(--color-feudum-text);
        box-shadow: inset 0 0 0 1px var(--color-feudum-frame);
    }

    .history-action:hover:not(:disabled) {
        background: var(--color-feudum-frame);
    }

    .history-action:disabled {
        opacity: 0.5;
    }

    @media (pointer: coarse) {
        .history-action {
            min-width: 44px;
            min-height: 44px;
        }
    }
</style>
