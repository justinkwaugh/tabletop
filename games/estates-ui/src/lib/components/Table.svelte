<script lang="ts">
    import {
        GameSessionMode,
        DefaultSideContent,
        DefaultTableLayout,
        GameSession
    } from '@tabletop/frontend-components'
    import Board from '$lib/components/Board.svelte'
    import { onMount } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import type { EstatesGameState, HydratedEstatesGameState } from '@tabletop/estates'
    import History from '$lib/components/History.svelte'
    import LastActionDescription from './LastActionDescription.svelte'
    import PlayersPanel from './PlayersPanel.svelte'
    import { setGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let { gameSession }: { gameSession: GameSession<EstatesGameState, HydratedEstatesGameState> } =
        $props()
    // svelte-ignore state_referenced_locally
    const estatesSession = gameSession as EstatesGameSession

    setGameSession(estatesSession)

    let table: HTMLDivElement
    onMount(() => {
        table.scrollTo({ left: table.scrollWidth, behavior: 'instant' })
    })
</script>

{#snippet playersPanel()}
    <PlayersPanel />
{/snippet}

<div bind:this={table}>
    <DefaultTableLayout>
        {#snippet sideContent()}
            <DefaultSideContent playersPanel={estatesSession.mobileView ? playersPanel : undefined}>
                {#snippet history()}
                    <History />
                {/snippet}
            </DefaultSideContent>
        {/snippet}
        {#snippet gameContent()}
            {#if gameSession.isViewingHistory || gameSession.isPlayable}
                <LastActionDescription />
            {/if}
            <!--  Bottom part fills the remaining space, but hides overflow to keep it's height fixed.
              This allows the wrapper to scale to its bounds regardless of its content size-->
            <div class="relative grow-0 overflow-hidden" style="flex:1;">
                <Board />
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<!-- 
            <Tabs
                tabStyle="pill"
                classes={{
                    content: 'p-0 mt-0 dark:bg-transparent h-full overflow-auto rounded-lg'
                }}
            >
                {#if gameSession.mobileView}
                    <TabItem
                        open={gameSession.mobileView}
                        onclick={onNonChatClick}
                        activeClass={activeTabClasses}
                        inactiveClass={inactiveTabClasses}
                    >
                        {#snippet titleSlot()}
                            <div class="flex items-center gap-2">
                                <UserCircleSolid size="md" />
                                Players
                            </div>
                        {/snippet}
                        <PlayersPanel />
                    </TabItem>
                {/if}
                <TabItem
                    open={!gameSession.mobileView}
                    onclick={onNonChatClick}
                    activeClass={activeTabClasses}
                    inactiveClass={inactiveTabClasses}
                >
                    {#snippet titleSlot()}
                        <div class="flex items-center gap-2">
                            <ClockSolid size="md" />
                            History
                        </div>
                    {/snippet}
                    <History />
                </TabItem>
                {#if !gameSession.game.hotseat}
                    <TabItem
                        onclick={onChatClick}
                        activeClass={activeTabClasses}
                        inactiveClass={inactiveTabClasses}
                    >
                        {#snippet titleSlot()}
                            <div class="flex items-center gap-2">
                                <AnnotationSolid size="md" />
                                Chat
                                {#if showNewMessageIndicator}
                                    <Indicator
                                        color="red"
                                        size="lg"
                                        placement="top-right"
                                        class="-end-0.5 text-xs font-bold text-white w-4 h-4 border border-gray-200"
                                    ></Indicator>
                                {/if}
                            </div>
                        {/snippet}
                        <GameChat height={'h-[calc(100dvh-202px)] sm:h-[calc(100dvh-178px)]'} />
                    </TabItem>
                {/if}
            </Tabs>
        -->
