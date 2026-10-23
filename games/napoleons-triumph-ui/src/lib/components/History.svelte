<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { chaptersInOrder, type HistoryLine } from '$lib/model/historyChapters.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { pinToNewest } from '$lib/utils/pinToNewest.js'

    const gameSession = getGameSession()
    const newestFirst = $derived(gameSession.historyNewestFirst)
    const chapters = $derived(chaptersInOrder(gameSession.chapters, newestFirst))

    const indexId = $props.id()
    let scroller: HTMLDivElement | undefined = $state()
    let index: HTMLDivElement | undefined = $state()
    let indexButton: HTMLButtonElement | undefined = $state()
    let indexOpen = $state(false)
    let indexBounds = $state({ left: 0, top: 0, width: 0, height: 0 })

    // The index lies over the list it leads into, measured as it opens.
    function placeIndex(event: ToggleEvent) {
        indexOpen = event.newState === 'open'
        if (indexOpen && scroller) {
            const { left, top, width, height } = scroller.getBoundingClientRect()
            indexBounds = { left, top, width, height }
        }
    }

    function goToChapter(title: string) {
        assertExists(scroller, 'The history list is drawn')
        const section = [...scroller.querySelectorAll<HTMLElement>('[data-chapter]')].find(
            (element) => element.dataset.chapter === title
        )
        assertExists(section, 'Every chapter in the index is listed')
        scroller.scrollTop +=
            section.getBoundingClientRect().top - scroller.getBoundingClientRect().top
        index?.hidePopover()
        indexButton?.focus()
    }
</script>

<svelte:window onresize={() => index?.hidePopover()} />

{#snippet told(entry: HistoryLine)}
    <span
        class="nt-history-mark"
        style="background: {entry.playerId
            ? gameSession.colors.getPlayerUiColor(entry.playerId)
            : '#8a857a'};"
    ></span>
    <span>{entry.text}</span>
{/snippet}

{#snippet line(entry: HistoryLine, time: string, step: boolean)}
    {#if entry.pictured}
        <button
            type="button"
            class="nt-history-entry nt-history-pictured"
            class:nt-history-step={step}
            onclick={() => gameSession.openHistoryLine(entry, time)}
        >
            {@render told(entry)}
        </button>
    {:else}
        <div class="nt-history-entry" class:nt-history-step={step}>{@render told(entry)}</div>
    {/if}
{/snippet}

<div class="nt-history-panel">
    <div class="nt-history-toolbar">
        <div class="nt-history-order" role="group" aria-label="History order">
            <button
                type="button"
                aria-pressed={!newestFirst}
                onclick={() => gameSession.setHistoryNewestFirst(false)}>Newest last</button
            >
            <span aria-hidden="true">/</span>
            <button
                type="button"
                aria-pressed={newestFirst}
                onclick={() => gameSession.setHistoryNewestFirst(true)}>Newest first</button
            >
        </div>
        <button
            type="button"
            class="nt-history-index-button"
            bind:this={indexButton}
            popovertarget={indexId}
            aria-expanded={indexOpen}
            aria-controls={indexId}>Index</button
        >
    </div>
    <div
        id={indexId}
        bind:this={index}
        class="nt-history-index"
        popover="auto"
        onbeforetoggle={placeIndex}
        style:left="{indexBounds.left}px"
        style:top="{indexBounds.top}px"
        style:width="{indexBounds.width}px"
        style:max-height="{indexBounds.height}px"
    >
        <nav aria-label="History index">
            {#each chapters as chapter (chapter.title)}
                <button type="button" onclick={() => goToChapter(chapter.title)}
                    >{chapter.title}</button
                >
            {:else}
                <p>Nothing has happened yet.</p>
            {/each}
        </nav>
    </div>
    <div
        class="nt-history-scroll"
        bind:this={scroller}
        role="region"
        aria-label="Scrollable history"
        {@attach pinToNewest(newestFirst)}
    >
        <div class="nt-history" class:nt-history-newest-last={!newestFirst}>
            {#each chapters as chapter (chapter.title)}
                <section class="nt-history-chapter" data-chapter={chapter.title}>
                    <h3>{chapter.title}</h3>
                    {#each chapter.turns as turn (`${turn.playerId}@${turn.start}`)}
                        {#if turn.title}
                            <h4>{turn.title}</h4>
                        {/if}
                        {#each turn.entries as entry (entry.index)}
                            {@render line(entry, chapter.title, false)}
                            {#each entry.steps as step (step.index)}
                                {@render line(step, chapter.title, true)}
                            {/each}
                        {/each}
                    {/each}
                </section>
            {:else}
                <p>Nothing has happened yet.</p>
            {/each}
        </div>
    </div>
</div>

<style>
    .nt-history-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        color: #2b2620;
    }

    .nt-history-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 6px 2px 4px;
        font-size: 12px;
        border-bottom: 1px solid rgba(43, 38, 32, 0.3);
    }

    .nt-history-order {
        display: flex;
        align-items: center;
        gap: 6px;
        color: rgba(43, 38, 32, 0.55);
    }

    .nt-history-order button,
    .nt-history-index-button {
        color: rgba(43, 38, 32, 0.7);
        cursor: pointer;
    }

    .nt-history-order button[aria-pressed='true'] {
        color: #2b2620;
        font-weight: 700;
    }

    .nt-history-order button:hover,
    .nt-history-index-button:hover {
        color: #2b2620;
    }

    .nt-history-index {
        position: fixed;
        inset: auto;
        margin: 0;
        box-sizing: border-box;
        padding: 5px;
        border: 1px solid rgba(43, 38, 32, 0.4);
        border-radius: 4px;
        background: #f1ecdc;
        color: #2b2620;
        overflow-y: auto;
        overscroll-behavior: contain;
    }

    .nt-history-index nav {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .nt-history-index nav button {
        padding: 5px 8px;
        border: 1px solid rgba(43, 38, 32, 0.25);
        border-radius: 3px;
        font-size: 13px;
        font-style: italic;
        text-align: left;
        cursor: pointer;
    }

    .nt-history-index nav button:hover {
        background: rgba(43, 38, 32, 0.07);
    }

    .nt-history-scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
    }

    .nt-history-chapter {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .nt-history-newest-last {
        margin-top: auto;
    }

    .nt-history {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 6px 4px;
        color: #2b2620;
        font-size: 13px;
        line-height: 1.3;
    }

    h3 {
        position: sticky;
        top: 0;
        z-index: 1;
        margin-top: 6px;
        padding: 2px 0;
        font-size: 14px;
        font-style: italic;
        background: #e9e6dc;
        border-bottom: 1px solid rgba(43, 38, 32, 0.3);
    }

    h4 {
        margin-top: 4px;
        font-size: 12px;
        font-weight: 600;
        color: rgba(43, 38, 32, 0.7);
    }

    .nt-history-entry {
        display: grid;
        grid-template-columns: 6px 1fr;
        gap: 6px;
        text-align: left;
        padding: 2px 0;
    }

    .nt-history-step {
        margin-left: 12px;
        font-size: 12px;
    }

    .nt-history-pictured:hover {
        background: rgba(43, 38, 32, 0.07);
    }

    .nt-history-mark {
        border-radius: 1px;
    }
</style>
