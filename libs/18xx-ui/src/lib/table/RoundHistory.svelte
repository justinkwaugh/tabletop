<script lang="ts">
    import { tick, type Snippet } from 'svelte'
    import { assertExists } from '@tabletop/common'
    import type { HistoryRound } from './historyRounds.js'
    let {
        rounds,
        children,
        phaseColors,
        newestFirst = false,
        onOrderChange
    }: {
        rounds: HistoryRound[]
        children: Snippet<[HistoryRound]>
        phaseColors: Readonly<Record<string, string>>
        newestFirst?: boolean
        onOrderChange: (newestFirst: boolean) => void
    } = $props()
    let scrollElement: HTMLDivElement | undefined = $state()
    $effect(() => {
        const first = newestFirst
        const element = scrollElement
        void tick().then(() => {
            if (element) element.scrollTop = first ? 0 : element.scrollHeight
        })
    })
    function phaseBackground(round: HistoryRound) {
        const colors = round.phases
            .map((phase) => {
                const color = phaseColors[phase]
                assertExists(color, `Unknown history phase color: ${phase}`)
                return `color-mix(in srgb, ${color} 55%, #f7f5f0)`
            })
            .filter((color, index, all) => index === 0 || color !== all[index - 1])
        return `linear-gradient(45deg, ${colors
            .map(
                (color, index) =>
                    `${color} ${(index * 100) / colors.length}% ${((index + 1) * 100) / colors.length}%`
            )
            .join(', ')})`
    }
</script>

<div class="round-history">
    <div class="history-order" role="group" aria-label="History order">
        <button type="button" aria-pressed={!newestFirst} onclick={() => onOrderChange(false)}>Newest last</button>
        <span aria-hidden="true">/</span>
        <button type="button" aria-pressed={newestFirst} onclick={() => onOrderChange(true)}>Newest first</button>
    </div>
    <div class="history-scroll" bind:this={scrollElement} role="region" aria-label="Scrollable history">
        <ol class="history-content" class:newest-last={!newestFirst} aria-label="Action history">
            {#each newestFirst ? rounds : rounds.toReversed() as round (round.id)}
                <li class="round-section" aria-label={round.label}>
                    {#snippet divider()}
                    <h3 class="round-divider" style:background={phaseBackground(round)}>
                        <span>{round.label.replace(/^OR /, 'Operating round ').replace(/^SR /, 'Stock round ')}</span>
                        <span class="round-phase">Phase {round.phases.join(' → ')}</span>
                    </h3>
                    {/snippet}
                    {#if !newestFirst}{@render divider()}{/if}
                    {@render children(round)}
                    {#if newestFirst}{@render divider()}{/if}
                </li>
            {:else}<li class="empty">No actions yet.</li>{/each}
        </ol>
    </div>
</div>

<style>
    .round-history {
        --history-item-gap: 5px;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        overflow: hidden;
    }
    .history-scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: thin;
        overscroll-behavior: contain;
    }
    .history-order {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 7px;
        padding: 0 6px 2px;
        color: #9b8e7c;
        font-size: 11px;
    }
    .history-order button {
        border: 0;
        background: none;
        padding: 2px 0;
        color: #817565;
        font: inherit;
        cursor: pointer;
    }
    .history-order button[aria-pressed='true'] {
        color: #463e35;
        font-weight: 650;
    }
    .history-order button:hover {
        color: #30271f;
    }
    .history-content {
        flex-shrink: 0;
        list-style: none;
        padding: 0;
        margin: 0;
    }
    .history-content.newest-last {
        margin-top: auto;
    }
    .round-section {
        margin: 0;
        padding: 0;
    }
    .round-divider {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 36px;
        box-sizing: border-box;
        margin: var(--history-item-gap) 0;
        padding: 7px 10px;
        border-top: 2px solid #6f5c46;
        border-bottom: 2px solid #6f5c46;
        color: #30271f;
        font: 750 13px/1.3 ui-sans-serif, system-ui, sans-serif;
    }
    .round-phase {
        font-size: 11px;
        font-weight: 600;
        text-align: right;
    }
    .empty {
        padding: 20px 8px;
        color: #7d7266;
        font-size: 13px;
    }
</style>
