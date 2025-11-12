<script lang="ts">
    import { GameSessionMode, GameSession } from '@tabletop/frontend-components'

    import { getContext, type Snippet } from 'svelte'

    import type { GameState, HydratedGameState } from '@tabletop/common'
    import AdminPanel from './AdminPanel.svelte'
    import HistoryControls from './HistoryControls.svelte'

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

    let gameSession = getContext('gameSession') as GameSession<GameState, HydratedGameState>

    // Heights used in CSS calculations:
    // Not Mobile(sm and up):
    // - Navbar: 68px
    // - Hotseat Banner: 44px
    // - Exploration Banner: 44px
    // Mobile (max-sm):
    // - Navbar: 68px
    // - Game Title Banner: 32px
    // - Hotseat Banner: 44px
    // - Exploration Banner: 44px

    let tableHeightOffset = $derived.by(() => {
        let offset = 68 // Navbar

        if (gameSession.isExploring) {
            offset += 44 // Exploration Banner
        } else if (gameSession.game.hotseat) {
            offset += 44 // Hotseat Banner
        }

        return offset
    })

    const tableHeightMobileClass = 'max-sm:h-[calc(100vh-32px-var(--table-height-offset))]'
    const tableHeightDesktopClass = 'sm:h-[calc(100vh-var(--table-height-offset))]'
    const tableInnerHeightMobileClass =
        'max-sm:h-[calc(100vh-16px-32px-44px-var(--table-height-offset))]'
    const tableInnerHeightDesktopClass = 'sm:h-[calc(100vh-16px-var(--table-height-offset))]'
</script>

<div
    class="flex w-screen overflow-auto {tableHeightDesktopClass} {tableHeightMobileClass} box-border"
    style="--table-height-offset: {tableHeightOffset}px;"
>
    <div class="flex flex-col w-full">
        <div class="sm:hidden">
            {#if mobileControlsContent}
                {@render mobileControlsContent()}
            {:else}
                <HistoryControls borderClass="border-gray-700 border-b-2" />
            {/if}
        </div>
        <div class="w-full overflow-auto">
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
                            <AdminPanel />
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>
