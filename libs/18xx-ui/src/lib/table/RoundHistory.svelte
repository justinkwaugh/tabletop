<script lang="ts">
    import { contrastingTextColor } from '../colors/contrastingTextColor.js'
    import HistoryJump from './HistoryJump.svelte'
    import { tick, type Snippet } from 'svelte'
    import { assertExists } from '@tabletop/common'
    import type { HistoryRound } from './historyRounds.js'
    let {
        rounds,
        children,
        phaseColors,
        newestFirst = false,
        historyComplete = true,
        onJump,
        jumpDisabled = false,
        onOrderChange
    }: {
        onJump: (index: number) => void
        jumpDisabled?: boolean
        rounds: HistoryRound[]
        children: Snippet<[HistoryRound]>
        phaseColors: Readonly<Record<string, string>>
        newestFirst?: boolean
        historyComplete?: boolean
        onOrderChange: (newestFirst: boolean) => void
    } = $props()
    const indexId = $props.id()
    let indexPanel: HTMLDivElement | undefined = $state()
    let indexButton: HTMLButtonElement | undefined = $state()
    let indexOpen = $state(false)
    let indexBounds = $state({ left: 0, top: 0, width: 0, height: 0 })
    function prepareIndex(event: ToggleEvent) {
        indexOpen = event.newState === 'open'
        if (!indexOpen || !scrollElement) return
        const bounds = scrollElement.getBoundingClientRect()
        indexBounds = { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }
    }
    function scrollToRound(id: string) {
        assertExists(scrollElement, 'History scrolling region is mounted')
        const section = [...scrollElement.querySelectorAll('[data-round-id]')]
            .find((element) => element.getAttribute('data-round-id') === id)
        assertExists(section, 'Selected history round is rendered')
        const bounds = section.getBoundingClientRect()
        const viewport = scrollElement.getBoundingClientRect()
        scrollElement.scrollTop += newestFirst
            ? bounds.bottom - viewport.bottom
            : bounds.top - viewport.top
        indexPanel?.hidePopover()
        indexButton?.focus()
    }
    let scrollElement: HTMLDivElement | undefined = $state()
    $effect(() => {
        const first = newestFirst
        const element = scrollElement
        if (!historyComplete) return
        void tick().then(() => {
            if (element) element.scrollTop = first ? 0 : element.scrollHeight
        })
    })
    function phaseBackground(round: HistoryRound) {
        const colors = round.phases
            .map((phase) => {
                const color = phaseColors[phase]
                assertExists(color, `Unknown history phase color: ${phase}`)
                return `color-mix(in srgb, ${color} var(--rail-phase-tint, 55%), var(--rail-surface, #f7f5f0))`
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

<svelte:window onresize={() => indexPanel?.hidePopover()} />

<div class="round-history" class:newest-first={newestFirst}>
    <div class="history-toolbar">
    <div class="history-order" role="group" aria-label="History order">
        <button type="button" aria-pressed={!newestFirst} onclick={() => onOrderChange(false)}>Newest last</button>
        <span aria-hidden="true">/</span>
        <button type="button" aria-pressed={newestFirst} onclick={() => onOrderChange(true)}>Newest first</button>
    </div>
    <button class="index-button" type="button" bind:this={indexButton}
        popovertarget={indexId} aria-expanded={indexOpen} aria-controls={indexId}>Index</button>
    </div>
    <div id={indexId} bind:this={indexPanel} class="round-index" popover="auto"
        onbeforetoggle={prepareIndex}
        style:left={`${indexBounds.left}px`} style:top={`${indexBounds.top}px`}
        style:width={`${indexBounds.width}px`} style:max-height={`${indexBounds.height}px`}>
        <nav aria-label="History round index">
            {#each newestFirst ? rounds : rounds.toReversed() as round (round.id)}
                <button type="button" style:background={phaseBackground(round)} style:--phase-ink={contrastingTextColor(phaseColors[round.phases[0]])} onclick={() => scrollToRound(round.id)}>
                    <strong>{round.label}</strong><span>Phase {round.phases.join(' → ')}</span>
                </button>
            {:else}<div class="empty">No rounds yet.</div>{/each}
        </nav>
    </div>
    <div class="history-scroll" bind:this={scrollElement} role="region" aria-label="Scrollable history">
        <ol class="history-content" class:newest-last={!newestFirst} aria-label="Action history">
            {#each newestFirst ? rounds : rounds.toReversed() as round (round.id)}
                <li class="round-section" data-round-id={round.id} aria-label={round.label}>
                    {#snippet divider()}
                    <h3 class="round-divider" style:background={phaseBackground(round)} style:--phase-ink={contrastingTextColor(phaseColors[round.phases[0]])}>
                        <span>{round.label.replace(/^OR /, 'Operating round ').replace(/^SR /, 'Stock round ')}</span>
                        {#if round.startActionIndex !== undefined}<HistoryJump label={`Jump to ${round.label} in history`} disabled={jumpDisabled} onclick={() => { if (round.startActionIndex !== undefined) onJump(round.startActionIndex) }} />{/if}
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
    .round-divider,
    .round-index nav button {
        --rail-text: light-dark(#30271f, var(--phase-ink));
        --rail-muted: light-dark(#817565, var(--phase-ink));
    }

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
    .history-toolbar {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        padding-right: 6px;
    }
    .index-button { justify-self: end; }
    .round-index {
        position: fixed;
        inset: auto;
        margin: 0;
        box-sizing: border-box;
        padding: 5px;
        border: 1px solid var(--rail-border, #a2917a);
        border-radius: 5px;
        background: var(--rail-surface-raised, #eee8df);
        box-shadow: 0 6px 18px var(--rail-shadow, #30271f40);
        overflow-y: auto;
        overscroll-behavior: contain;
    }
    .round-index nav { display: flex; flex-direction: column; gap: 3px; }
    .round-index nav button {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px;
        border: 1px solid var(--rail-border, #9d8d78);
        border-radius: 3px;
        color: var(--rail-text, #30271f);
        font: 12px/1.3 ui-sans-serif, system-ui, sans-serif;
        cursor: pointer;
        text-align: left;
    }
    .round-index nav button:hover { filter: var(--rail-phase-filter, brightness(0.95)); }
    .round-index nav button span { font-size: 11px; }
    .history-order {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 7px;
        padding: 0 6px 2px;
        color: var(--rail-muted, #9b8e7c);
        font-size: 11px;
    }
    .history-order button, .index-button {
        border: 0;
        background: none;
        padding: 2px 0;
        color: var(--rail-muted, #817565);
        font: inherit;
        cursor: pointer;
    }
    .index-button { font-size: 11px; }
    .history-order button[aria-pressed='true'] {
        color: var(--rail-text, #463e35);
        font-weight: 650;
    }
    .history-order button:hover {
        color: var(--rail-text, #30271f);
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
        display: flow-root;
        margin: 0;
        padding: 0;
    }
    .round-divider {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 36px;
        box-sizing: border-box;
        margin: 0;
        padding: 7px 10px;
        border-top: 2px solid var(--rail-interstitial-border, #6f5c46);
        border-bottom: 2px solid var(--rail-interstitial-border, #6f5c46);
        color: var(--rail-text, #30271f);
        font: 750 13px/1.3 ui-sans-serif, system-ui, sans-serif;
    }
    .newest-first .round-divider {
        top: auto;
        bottom: 0;
    }
    .round-phase {
        margin-left: auto;
        font-size: 11px;
        font-weight: 600;
        text-align: right;
    }
    .empty {
        padding: 20px 8px;
        color: var(--rail-text, #7d7266);
        font-size: 13px;
    }
</style>
