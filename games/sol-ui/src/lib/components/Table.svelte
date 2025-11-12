<script lang="ts">
    import {
        GameSessionMode,
        ScalingWrapper,
        AdminPanel,
        HistoryControls,
        GameChat,
        type ChatEvent,
        ChatEventType,
        ChatToast
    } from '@tabletop/frontend-components'
    import Board from '$lib/components/Board.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'

    import { getContext, onMount } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    // import WaitingPanel from '$lib/components/WaitingPanel.svelte'
    // import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import { Indicator, TabItem, Tabs } from 'flowbite-svelte'
    import { UserCircleSolid, ClockSolid, AnnotationSolid } from 'flowbite-svelte-icons'
    import { toast } from 'svelte-sonner'
    import starsBg from '$lib/images/stars.jpg'
    // import LastActionDescription from './LastActionDescription.svelte'

    let gameSession = getContext('gameSession') as SolGameSession
    let chatActive: boolean = $state(false)
    let showNewMessageIndicator: boolean = $derived(
        gameSession.myPlayer !== undefined &&
            gameSession.chatService.hasUnreadMessages &&
            !chatActive
    )

    let activeTabClasses =
        'relative py-1 px-3 bg-gray-300 border-2 border-transparent rounded-lg text-gray-900 box-border'
    let inactiveTabClasses =
        'relative text-gray-200 py-1 px-3 rounded-lg border-2 border-transparent hover:border-gray-700 box-border'

    let table: HTMLDivElement

    function onChatClick() {
        chatActive = true
    }

    function onNonChatClick() {
        chatActive = false
    }

    async function chatListener(event: ChatEvent) {
        if (event.eventType === ChatEventType.NewGameChatMessage && !chatActive) {
            toast.custom(ChatToast, {
                duration: 3000,
                position: 'bottom-left',
                componentProps: {
                    message: event.message,
                    playerName: gameSession.getPlayerName(event.message.playerId),
                    playerBgColor: gameSession.colors.getPlayerBgColor(event.message.playerId),
                    playerTextColor: gameSession.colors.getPlayerTextColor(event.message.playerId)
                }
            })
        }
    }

    onMount(() => {
        const chatService = gameSession.chatService
        chatService.addListener(chatListener)

        return () => {
            chatService.removeListener(chatListener)
        }
    })

    onMount(() => {
        table.scrollTo({ left: table.scrollWidth, behavior: 'instant' })
    })

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
        if (gameSession.isExploring) {
            return `${tableHeightMobileExploration} ${tableHeightDesktopExploration}`
        }
        if (gameSession.game.hotseat) {
            return `${tableHeightMobileHotseat} ${tableHeightDesktopHotseat}`
        }
        return `${tableHeightMobile} ${tableHeightDesktop}`
    })

    const innerTableHeight = $derived.by(() => {
        if (gameSession.isExploring) {
            return `${innerTableHeightMobileExploration} ${innerTableHeightDesktopExploration}`
        }
        if (gameSession.game.hotseat) {
            return `${innerTableHeightMobileHotseat} ${innerTableHeightDesktopHotseat}`
        }
        return `${innerTableHeightMobile} ${innerTableHeightDesktop}`
    })
</script>

<!-- Full Height and Width with 8px padding-->
<div
    bind:this={table}
    class="flex w-screen overflow-auto {tableHeight} bg-repeat"
    style="background-image: url('{starsBg}')"
>
    <div class="p-2 w-full h-full flex flex-row justify-between items-start">
        <!--  Panels have screen minus the height of navbar plus padding -->
        <div
            class="flex flex-col space-y-2 shrink-0 grow-0 w-[320px] min-w-[320px] max-w-[90vw] {innerTableHeight}"
        >
            <div
                class="shrink-0 grow-0 p-2 rounded-lg border-2 border-gray-700 bg-transparent h-[42px] max-sm:hidden"
            >
                <HistoryControls />
            </div>
            <Tabs tabStyle="pill" contentClass="p-0 bg-transparent h-full overflow-auto rounded-lg">
                <TabItem
                    open
                    onclick={onNonChatClick}
                    activeClasses={activeTabClasses}
                    inactiveClasses={inactiveTabClasses}
                >
                    <div slot="title" class="flex items-center gap-2">
                        <UserCircleSolid size="md" />
                        Players
                    </div>

                    <PlayersPanel />
                </TabItem>
                <TabItem
                    onclick={onNonChatClick}
                    activeClasses={activeTabClasses}
                    inactiveClasses={inactiveTabClasses}
                >
                    <div slot="title" class="flex items-center gap-2">
                        <ClockSolid size="md" />
                        History
                    </div>
                    <History />
                </TabItem>
                {#if !gameSession.game.hotseat}
                    <TabItem
                        onclick={onChatClick}
                        activeClasses={activeTabClasses}
                        inactiveClasses={inactiveTabClasses}
                    >
                        <div slot="title" class="flex items-center gap-2">
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

                        <GameChat />
                    </TabItem>
                {/if}
            </Tabs>
        </div>
        <div
            class="ms-2 pe-2 sm:pe-0 shrink grow sm:min-w-[320px] min-w-[90vw] {innerTableHeight} flex flex-col"
        >
            <!--  Top part is not allowed to shrink -->
            <div class="shrink-0">
                {#if gameSession.gameState.result}
                    <!-- <GameEndPanel /> -->
                {:else if gameSession.isViewingHistory}
                    <!-- <LastActionDescription /> -->
                {:else if gameSession.isPlayable}
                    <!-- <LastActionDescription /> -->
                    {#if gameSession.isMyTurn}
                        <ActionPanel />
                    {:else}
                        <!-- <WaitingPanel /> -->
                    {/if}
                {/if}
            </div>
            <!--  Bottom part fills the remaining space, but hides overflow to keep it's height fixed.
              This allows the wrapper to scale to its bounds regardless of its content size-->
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify={'center'} controls={'top-left'}>
                    <Board />
                </ScalingWrapper>
            </div>
        </div>
        {#if gameSession.showDebug}
            <div class="flex flex-col space-y-2 shrink-0 grow-0 w-[400px]">
                <AdminPanel />
            </div>
        {/if}
    </div>
</div>

<style global>
    @font-face {
        font-family: 'metropolis';
        src: url('/Metropolis-Bold.woff') format('woff');
    }

    :global(.sol-font) {
        font-family: 'metropolis', ui-sans-serif, system-ui, sans-serif;
    }

    :global(.sol-font-bold) {
        font-family: 'metropolis', ui-sans-serif, system-ui, sans-serif;
        font-weight: bold;
        letter-spacing: 0.2em;
    }

    :global(.sol.green .a) {
        color: #88c188;
        fill: #88c188;
    }

    :global(.sol.green .b) {
        color: #6db16d;
        fill: #6db16d;
    }

    :global(.sol.green .c) {
        color: #389638;
        fill: #389638;
    }

    :global(.sol.green .d) {
        color: #116511;
        fill: #116511;
    }

    :global(.sol.blue .a) {
        color: #0e97c6;
        fill: #0e97c6;
    }

    :global(.sol.blue .b) {
        color: #0e9cca;
        fill: #0e9cca;
    }

    :global(.sol.blue .c) {
        color: #0c7ea4;
        fill: #0c7ea4;
    }

    :global(.sol.blue .d) {
        color: #12404c;
        fill: #12404c;
    }

    :global(.sol.purple .a) {
        color: #b58ad0;
        fill: #b58ad0;
    }

    :global(.sol.purple .b) {
        color: #ad7fcb;
        fill: #ad7fcb;
    }

    :global(.sol.purple .c) {
        color: #9f6dc2;
        fill: #9f6dc2;
    }

    :global(.sol.purple .d) {
        color: #773fa9;
        fill: #773fa9;
    }

    :global(.sol.gray .a) {
        color: #d2d4d7;
        fill: #d2d4d7;
    }

    :global(.sol.gray .b) {
        color: #ccced2;
        fill: #ccced2;
    }

    :global(.sol.gray .c) {
        color: #bbbbbb;
        fill: #bbbbbb;
    }

    :global(.sol.gray .d) {
        color: #777777;
        fill: #777777;
    }
</style>
