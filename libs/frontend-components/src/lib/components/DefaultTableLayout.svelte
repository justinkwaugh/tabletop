<script lang="ts">
    import { type Snippet } from 'svelte'
    import { scrollToRight } from '$lib/utils/scrollOnLoad.js'
    import DebugPanel from './DebugPanel.svelte'
    import HistoryControls from './HistoryControls.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.js'

    let {
        mobileControlsContent,
        gameContent,
        sideContent,
        debugContent
    }: {
        mobileControlsContent?: Snippet
        gameContent?: Snippet
        sideContent?: Snippet
        debugContent?: Snippet
    } = $props()

    let gameSession = getGameSession()

    const tableHeightMobileClass = 'max-sm:h-[calc(100dvh-var(--app-shell-height))]'
    const tableHeightDesktopClass = 'sm:h-[calc(100dvh-var(--app-shell-height))]'
    const tableInnerHeightMobileClass =
        'max-sm:h-[calc(100dvh-16px-44px-var(--app-shell-height))]'
    const tableInnerHeightDesktopClass = 'sm:h-[calc(100dvh-16px-var(--app-shell-height))]'
</script>

<div
    class="flex w-full overflow-auto {tableHeightDesktopClass} {tableHeightMobileClass} box-border"
    style="--app-shell-height: calc(var(--app-navbar-height, 0px) + var(--app-banner-height, 0px)); --table-height-offset: var(--app-shell-height); --safe-area-right: env(safe-area-inset-right, 0px); --safe-area-bottom: env(safe-area-inset-bottom, 0px); --safe-area-left: env(safe-area-inset-left, 0px); padding: 0 var(--safe-area-right) var(--safe-area-bottom) var(--safe-area-left);"
>
    <div class="flex flex-col w-full">
        <div class="sm:hidden">
            {#if mobileControlsContent}
                {@render mobileControlsContent()}
            {:else}
                <HistoryControls borderClass="border-gray-700 border-b-2" />
            {/if}
        </div>
        <div {@attach scrollToRight} class="w-full overflow-auto">
            <div class="p-2 w-full h-full flex flex-row justify-between items-start">
                <div
                    class="flex flex-col gap-2 shrink-0 grow-0 w-[320px] min-w-[320px] max-w-[90vw] {tableInnerHeightDesktopClass} {tableInnerHeightMobileClass}"
                >
                    {#if sideContent}
                        {@render sideContent()}
                    {/if}
                </div>
                <div
                    class="ms-2 pe-2 sm:pe-0 shrink grow sm:min-w-[320px] min-w-[90vw] {tableInnerHeightDesktopClass} {tableInnerHeightMobileClass} flex flex-col overflow-auto"
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
