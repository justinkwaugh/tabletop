<script lang="ts">
    import { untrack, type Snippet } from 'svelte'
    import { MediaQuery } from 'svelte/reactivity'
    import GameToaster from './GameToaster.svelte'
    import { provideSideFold } from './sideFold.js'
    import { scrollToRight } from '$lib/utils/scrollOnLoad.js'
    import DebugPanel from './DebugPanel.svelte'
    import HistoryControls from './HistoryControls.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.js'

    let {
        mobileControlsContent,
        gameContent,
        sideContent,
        foldedSideContent,
        sideFolded = $bindable(false),
        debugContent,
        showSidebar = true,
        horizontalPadding = 8,
        topPadding = 8
    }: {
        mobileControlsContent?: Snippet
        gameContent?: Snippet
        sideContent?: Snippet
        foldedSideContent?: Snippet
        sideFolded?: boolean
        debugContent?: Snippet
        showSidebar?: boolean
        horizontalPadding?: number
        topPadding?: number
    } = $props()

    let gameSession = getGameSession()

    const tailwindSmAndUp = new MediaQuery('min-width: 40rem')
    const offersSideFold = untrack(() => foldedSideContent !== undefined)
    const sideFoldable = $derived(offersSideFold && tailwindSmAndUp.current)
    const folded = $derived(sideFoldable && sideFolded)

    if (offersSideFold) {
        provideSideFold({
            get folded() {
                return folded
            }
        })
    }

    const tableHeightMobileClass = 'max-sm:h-[calc(100dvh-var(--app-shell-height))]'
    const tableHeightDesktopClass = 'sm:h-[calc(100dvh-var(--app-shell-height))]'
    const tableInnerHeightMobileClass =
        'max-sm:h-[calc(100dvh-8px-var(--table-top-padding)-44px-var(--app-shell-height))]'
    const tableInnerHeightDesktopClass =
        'sm:h-[calc(100dvh-8px-var(--table-top-padding)-var(--app-shell-height))]'
</script>

<div
    class="flex w-full overflow-auto {tableHeightDesktopClass} {tableHeightMobileClass} box-border"
    style="--table-top-padding: {topPadding}px; --app-shell-height: calc(var(--app-navbar-height, 0px) + var(--app-banner-height, 0px)); --table-height-offset: var(--app-shell-height); --safe-area-right: env(safe-area-inset-right, 0px); --safe-area-bottom: env(safe-area-inset-bottom, 0px); --safe-area-left: env(safe-area-inset-left, 0px); padding: 0 var(--safe-area-right) var(--safe-area-bottom) var(--safe-area-left);"
>
    <div class="flex flex-col w-full">
        <div class="sm:hidden">
            {#if mobileControlsContent}
                {@render mobileControlsContent()}
            {:else}
                <HistoryControls borderClass="border-gray-700 border-b-2" />
            {/if}
        </div>
        <div {@attach scrollToRight} class="table-scroller w-full overflow-auto">
            <div
                class="p-2 w-full h-full flex flex-row justify-between items-start"
                style:padding-top={topPadding + 'px'}
                style:padding-inline={horizontalPadding + 'px'}
            >
                {#if showSidebar}<div
                        class="flex flex-col gap-2 shrink-0 grow-0 w-[320px] min-w-[320px] max-w-[90vw] {tableInnerHeightDesktopClass} {tableInnerHeightMobileClass}"
                        class:foldable-side={offersSideFold}
                        class:folded
                    >
                        {#if offersSideFold}
                            {#if folded && foldedSideContent}
                                {@render foldedSideContent()}
                            {/if}
                            <div class="side-content" class:folded inert={folded}>
                                {#if sideContent}
                                    {@render sideContent()}
                                {/if}
                            </div>
                        {:else if sideContent}
                            {@render sideContent()}
                        {/if}
                        {#if sideFoldable}
                            <button
                                type="button"
                                class="side-fold-tab"
                                aria-label={folded ? 'Show side panel' : 'Hide side panel'}
                                title={folded ? 'Show side panel' : 'Hide side panel'}
                                aria-expanded={!folded}
                                onclick={() => (sideFolded = !sideFolded)}
                            >
                                <svg viewBox="0 0 8 14" aria-hidden="true">
                                    <path d={folded ? 'M2 2 L6 7 L2 12' : 'M6 2 L2 7 L6 12'}></path>
                                </svg>
                            </button>
                        {/if}
                    </div>{/if}
                {#if offersSideFold}
                    <GameToaster />
                {/if}
                <div
                    class:ms-2={showSidebar}
                    class:beside-sidebar={showSidebar}
                    class="game-column shrink grow sm:min-w-[320px] min-w-[90vw] {tableInnerHeightDesktopClass} {tableInnerHeightMobileClass} flex flex-col overflow-auto"
                    style:--table-inline-padding={`${horizontalPadding}px`}
                >
                    {#if gameContent}
                        {@render gameContent()}
                    {/if}
                </div>
                {#if gameSession.showDebug}
                    <div class="flex flex-col space-y-2 shrink-0 grow-0 w-[400px]">
                        {#if debugContent}
                            {@render debugContent()}
                        {:else}
                            <DebugPanel />
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    .foldable-side {
        position: relative;
    }

    .foldable-side.folded {
        width: 48px;
        min-width: 48px;
    }

    .side-content {
        display: contents;
    }

    /* Kept mounted so its tabs and scroll positions survive the fold. */
    .side-content.folded {
        position: absolute;
        display: block;
        width: 0;
        overflow: hidden;
    }

    .side-fold-tab {
        position: absolute;
        top: 10px;
        right: -16px;
        z-index: 20;
        display: grid;
        place-items: center;
        width: 16px;
        height: 34px;
        border-radius: 0 6px 6px 0;
        color: var(--side-fold-tab-color, currentColor);
        background: var(--side-fold-tab-bg, color-mix(in srgb, currentColor 14%, transparent));
    }

    .side-fold-tab:hover {
        background: var(
            --side-fold-tab-hover-bg,
            color-mix(in srgb, currentColor 26%, transparent)
        );
    }

    .side-fold-tab svg {
        width: 7px;
        height: 12px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    /* Contains visually hidden labels, which otherwise escape the scroller's clip and widen the page. */
    .table-scroller {
        position: relative;
    }
    /* Beside the sidebar the row scrolls sideways, and a scroller drops its end padding. */
    @media (width < 40rem) {
        .game-column.beside-sidebar {
            padding-inline-end: var(--table-inline-padding);
        }
    }
</style>
