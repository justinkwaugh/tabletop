<script lang="ts">
    import { GameSessionMode, GameSession } from '@tabletop/frontend-components'

    import { getContext, type Snippet } from 'svelte'

    import type { GameState, HydratedGameState } from '@tabletop/common'
    import AdminPanel from './AdminPanel.svelte'

    let {
        gameContent,
        sideContent,
        debugContent
    }: {
        gameContent?: Snippet
        sideContent?: Snippet
        debugContent?: Snippet
    } = $props()

    let gameSession = getContext('gameSession') as GameSession<GameState, HydratedGameState>

    // Heights used in CSS calculations:
    // Not Mobile(sm and up):
    // - Navbar: 68px
    // - Hotseat Banner: 30px
    // - Exploration Banner: 44px
    // Mobile (max-sm):
    // - Navbar: 142px
    // - Hotseat Banner: 30px
    // - Exploration Banner: 44px

    const tableHeightMobile = 'max-sm:h-[calc(100vh-142px)]'
    const tableHeightMobileHotseat = 'max-sm:h-[calc(100vh-172px)]'
    const tableHeightMobileExploration = 'max-sm:h-[calc(100vh-186px)]'
    const tableHeightDesktop = 'h-[calc(100vh-84px)]'
    const tableHeightDesktopHotseat = 'h-[calc(100vh-114px)]'
    const tableHeightDesktopExploration = 'h-[calc(100vh-128px)]'
    const innerTableHeightMobile = 'max-sm:h-[calc(100vh-158px)]'
    const innerTableHeightMobileHotseat = 'max-sm:h-[calc(100vh-188px)]'
    const innerTableHeightMobileExploration = 'max-sm:h-[calc(100vh-202px)]'
    const innerTableHeightDesktop = 'h-[calc(100vh-100px)]'
    const innerTableHeightDesktopHotseat = 'h-[calc(100vh-130px)]'
    const innerTableHeightDesktopExploration = 'h-[calc(100vh-144px)]'

    const tableHeight = $derived.by(() => {
        if (gameSession.mode === GameSessionMode.Explore) {
            return `${tableHeightMobileExploration} ${tableHeightDesktopExploration}`
        }
        if (gameSession.game.hotseat) {
            return `${tableHeightMobileHotseat} ${tableHeightDesktopHotseat}`
        }
        return `${tableHeightMobile} ${tableHeightDesktop}`
    })

    const innerTableHeight = $derived.by(() => {
        if (gameSession.mode === GameSessionMode.Explore) {
            return `${innerTableHeightMobileExploration} ${innerTableHeightDesktopExploration}`
        }
        if (gameSession.game.hotseat) {
            return `${innerTableHeightMobileHotseat} ${innerTableHeightDesktopHotseat}`
        }
        return `${innerTableHeightMobile} ${innerTableHeightDesktop}`
    })
</script>

<div class="flex w-screen overflow-auto {tableHeight}">
    <div class="p-2 w-full h-full flex flex-row justify-between items-start">
        <div
            class="flex flex-col gap-2 shrink-0 grow-0 w-[320px] min-w-[320px] max-w-[90vw] {innerTableHeight}"
        >
            {#if sideContent}
                {@render sideContent()}
            {/if}
        </div>
        <div
            class="ms-2 pe-2 sm:pe-0 shrink grow sm:min-w-[320px] min-w-[90vw] {innerTableHeight} flex flex-col overflow-auto"
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
