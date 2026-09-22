<script lang="ts">
    import { contrastingTextColor } from '../colors/contrastingTextColor.js'
    import HistoryHeaderJump from './HistoryHeaderJump.svelte'
    import { tick, type Snippet } from 'svelte'
    import { assertExists } from '@tabletop/common'
    import type { HistoryRound } from './historyRounds.js'
    import type { HistoryOperatingOrder } from './historyOperatingOrder.js'
    let {
        rounds,
        children,
        phaseColors,
        newestFirst = false,
        historyComplete = true,
        onJump,
        onReturn,
        currentHeaderId,
        jumpDisabled = false,
        onOrderChange,
        orderContent
    }: {
        onJump: (index: number) => void
        onReturn: () => void
        currentHeaderId?: string
        jumpDisabled?: boolean
        rounds: HistoryRound[]
        children: Snippet<[HistoryRound]>
        phaseColors: Readonly<Record<string, string>>
        newestFirst?: boolean
        historyComplete?: boolean
        onOrderChange: (newestFirst: boolean) => void
        orderContent?: Snippet<[HistoryOperatingOrder]>
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
        indexBounds = {
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height
        }
    }
    function scrollToRound(id: string) {
        assertExists(scrollElement, 'History scrolling region is mounted')
        const section = [...scrollElement.querySelectorAll('[data-round-id]')].find(
            (element) => element.getAttribute('data-round-id') === id
        )
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
    function pinToNewest(
        element: HTMLDivElement,
        pin: { newestFirst: boolean; historyComplete: boolean }
    ) {
        function scrollToNewest({ newestFirst, historyComplete }: typeof pin) {
            if (!historyComplete) return
            void tick().then(() => {
                element.scrollTop = newestFirst ? 0 : element.scrollHeight
            })
        }
        scrollToNewest(pin)
        return { update: scrollToNewest }
    }
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
    function fitOperatingOrder(node: HTMLElement) {
        const order = node.querySelector<HTMLElement>('.round-order')
        if (!order) return
        const title = node.querySelector<HTMLElement>('.round-title')
        const phase = node.querySelector<HTMLElement>('.round-phase')
        assertExists(title, 'Operating round header requires its title')
        assertExists(phase, 'Operating round header requires its phase')
        const parts = { title, order, phase }
        function update() {
            const style = getComputedStyle(node)
            const available =
                node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
            const needed =
                parts.title.offsetWidth +
                parts.order.scrollWidth +
                parts.phase.offsetWidth +
                2 * parseFloat(style.columnGap)
            node.classList.toggle('order-on-second-line', needed > available)
        }
        const observer = new ResizeObserver(update)
        observer.observe(node)
        observer.observe(parts.title)
        observer.observe(parts.order)
        observer.observe(parts.phase)
        update()
        return { destroy: () => observer.disconnect() }
    }
</script>

<svelte:window onresize={() => indexPanel?.hidePopover()} />

<div class="round-history" class:newest-first={newestFirst}>
    <div class="history-toolbar">
        <div class="history-order" role="group" aria-label="History order">
            <button type="button" aria-pressed={!newestFirst} onclick={() => onOrderChange(false)}
                >Newest last</button
            >
            <span aria-hidden="true">/</span>
            <button type="button" aria-pressed={newestFirst} onclick={() => onOrderChange(true)}
                >Newest first</button
            >
        </div>
        <button
            class="index-button"
            type="button"
            bind:this={indexButton}
            popovertarget={indexId}
            aria-expanded={indexOpen}
            aria-controls={indexId}>Index</button
        >
    </div>
    <div
        id={indexId}
        bind:this={indexPanel}
        class="round-index"
        popover="auto"
        onbeforetoggle={prepareIndex}
        style:left={`${indexBounds.left}px`}
        style:top={`${indexBounds.top}px`}
        style:width={`${indexBounds.width}px`}
        style:max-height={`${indexBounds.height}px`}
    >
        <nav aria-label="History round index">
            {#each newestFirst ? rounds : rounds.toReversed() as round (round.id)}
                <button
                    type="button"
                    style:background={phaseBackground(round)}
                    style:--phase-ink={contrastingTextColor(phaseColors[round.phases[0]])}
                    onclick={() => scrollToRound(round.id)}
                >
                    <strong>{round.label}</strong><span>Phase {round.phases.join(' → ')}</span>
                </button>
            {:else}<div class="empty">No rounds yet.</div>{/each}
        </nav>
    </div>
    <div
        class="history-scroll"
        bind:this={scrollElement}
        use:pinToNewest={{ newestFirst, historyComplete }}
        role="region"
        aria-label="Scrollable history"
    >
        <ol class="history-content" class:newest-last={!newestFirst} aria-label="Action history">
            {#each newestFirst ? rounds : rounds.toReversed() as round (round.id)}
                <li class="round-section" data-round-id={round.id} aria-label={round.label}>
                    {#snippet divider()}
                        <h3
                            class="round-divider"
                            use:fitOperatingOrder
                            style:background={phaseBackground(round)}
                            style:--phase-ink={contrastingTextColor(phaseColors[round.phases[0]])}
                        >
                            <span class="round-title">
                                <span
                                    >{round.label
                                        .replace(/^OR /, 'Operating round ')
                                        .replace(/^SR /, 'Stock round ')}</span
                                >
                                {#if round.endActionIndex !== undefined}<HistoryHeaderJump
                                        onReturn={round.id === currentHeaderId
                                            ? onReturn
                                            : undefined}
                                        label={`Jump to ${round.label} in history`}
                                        disabled={jumpDisabled}
                                        onclick={() => {
                                            if (round.endActionIndex !== undefined)
                                                onJump(round.endActionIndex)
                                        }}
                                    />{/if}
                            </span>
                            {#if round.operatingOrder && orderContent}<span
                                    class="round-order"
                                    aria-label="Operating order"
                                    >{@render orderContent(round.operatingOrder)}</span
                                >{/if}
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
        --history-item-gap: 0.417em;
        container-type: inline-size;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        overflow: hidden;
    }
    .history-toolbar,
    .round-index,
    .history-scroll {
        font-size: clamp(12px, calc(8.8px + 1cqi), 16px);
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
        padding-right: 0.5em;
    }
    .index-button {
        justify-self: end;
    }
    .round-index {
        position: fixed;
        inset: auto;
        margin: 0;
        box-sizing: border-box;
        padding: 0.417em;
        border: 1px solid var(--rail-border, #a2917a);
        border-radius: 5px;
        background: var(--rail-surface-raised, #eee8df);
        box-shadow: 0 6px 18px var(--rail-shadow, #30271f40);
        overflow-y: auto;
        overscroll-behavior: contain;
    }
    .round-index nav {
        display: flex;
        flex-direction: column;
        gap: 0.25em;
    }
    .round-index nav button {
        display: flex;
        justify-content: space-between;
        gap: 0.667em;
        padding: 0.5em 0.667em;
        border: 1px solid var(--rail-border, #9d8d78);
        border-radius: 3px;
        color: var(--rail-text, #30271f);
        font:
            1em/1.3 ui-sans-serif,
            system-ui,
            sans-serif;
        cursor: pointer;
        text-align: left;
    }
    .round-index nav button:hover {
        filter: var(--rail-phase-filter, brightness(0.95));
    }
    .round-index nav button span {
        font-size: 0.917em;
    }
    .history-order {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.583em;
        padding: 0 0.5em 0.167em;
        color: var(--rail-muted, #9b8e7c);
        font-size: 0.917em;
    }
    .history-order button,
    .index-button {
        border: 0;
        background: none;
        padding: 0.167em 0;
        color: var(--rail-muted, #817565);
        font: inherit;
        cursor: pointer;
    }
    .index-button {
        font-size: 0.917em;
    }
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
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr) max-content;
        grid-template-areas: 'title order phase';
        align-items: center;
        column-gap: 0.615em;
        row-gap: 0.231em;
        min-height: 2.769em;
        box-sizing: border-box;
        margin: 0;
        padding: 0.538em 0.769em;
        border-top: 2px solid var(--rail-interstitial-border, #6f5c46);
        border-bottom: 2px solid var(--rail-interstitial-border, #6f5c46);
        color: var(--rail-text, #30271f);
        font:
            750 1.083em/1.3 ui-sans-serif,
            system-ui,
            sans-serif;
    }
    .newest-first .round-divider {
        top: auto;
        bottom: 0;
    }
    .round-title {
        grid-area: title;
        display: flex;
        align-items: center;
        gap: 0;
        width: max-content;
        white-space: nowrap;
    }
    .round-order {
        grid-area: order;
        display: flex;
        width: max-content;
        max-width: 100%;
        overflow-x: auto;
        font-size: 0.923em;
    }
    .round-order :global(.order-history),
    .round-order :global(.order) {
        flex-wrap: nowrap;
    }
    .round-divider:global(.order-on-second-line) {
        grid-template-columns: minmax(0, 1fr) max-content;
        grid-template-areas: 'title phase' 'order order';
    }
    :global(.order-on-second-line) .round-order {
        justify-self: center;
    }
    .round-phase {
        grid-area: phase;
        justify-self: end;
        font-size: 0.846em;
        font-weight: 600;
        text-align: right;
        white-space: nowrap;
    }
    .empty {
        padding: 1.538em 0.615em;
        color: var(--rail-text, #7d7266);
        font-size: 1.083em;
    }
</style>
