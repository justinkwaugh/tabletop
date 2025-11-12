<script lang="ts">
    import {
        GameSessionMode,
        ScalingWrapper,
        AdminPanel,
        HistoryControls,
        type ChatEvent,
        ChatEventType,
        ChatToast,
        GameChat
    } from '@tabletop/frontend-components'
    import Board from '$lib/components/Board.svelte'
    import { getContext, onMount, type ComponentType } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import Phase from '$lib/components/Phase.svelte'
    import BidBoard from '$lib/components/BidBoard.svelte'
    import { ActionType, MachineState } from '@tabletop/kaivai'
    import { TabItem, Tabs, Indicator } from 'flowbite-svelte'
    import { UserCircleSolid, ClockSolid, AnnotationSolid } from 'flowbite-svelte-icons'
    import History from '$lib/components/History.svelte'
    import LastHistoryDescription from '$lib/components/LastHistoryDescription.svelte'
    import WaitingPanel from '$lib/components/WaitingPanel.svelte'
    import EndOfGamePanel from './EndOfGamePanel.svelte'
    import { toast } from 'svelte-sonner'

    let gameSession = getContext('gameSession') as KaivaiGameSession
    let chatActive: boolean = $state(false)
    let showNewMessageIndicator: boolean = $derived(
        gameSession.myPlayer !== undefined &&
            gameSession.chatService.hasUnreadMessages &&
            !chatActive
    )

    let activeTabClasses =
        'relative py-1 px-3 bg-[#634a11] border-2 border-transparent rounded-lg text-gray-200 box-border text-md'
    let inactiveTabClasses =
        'relative text-[#634a11] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#634a11] box-border text-md'

    let showBidBoard = $derived.by(() => {
        if (gameSession.mode === GameSessionMode.Play) {
            return gameSession.gameState.machineState === MachineState.Bidding
        }
        if (gameSession.mode === GameSessionMode.History) {
            return (
                gameSession.currentAction && gameSession.currentAction.type === ActionType.PlaceBid
            )
        }

        return false
    })
    let table: HTMLDivElement
    onMount(() => {
        table.scrollTo({ left: table.scrollWidth, behavior: 'instant' })
    })

    function onChatClick() {
        chatActive = true
    }

    function onNonChatClick() {
        chatActive = false
    }

    async function chatListener(event: ChatEvent) {
        if (event.eventType === ChatEventType.NewGameChatMessage && !chatActive) {
            toast.custom(ChatToast as unknown as ComponentType, {
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

<!-- <div
    class="sm:hidden shrink-0 grow-0 p-2 h-[42px] bg-[#f5e397] flex flex-col justify-center items-center border-[#634a11] border-b-2"
>
    <HistoryControls enabledColor="text-[#634a11]" disabledColor="text-[#cabb7a]" />
</div> -->
<div bind:this={table} class="flex w-screen overflow-auto bg-[#f5e397] {tableHeight}">
    <!-- Full Height and Width with 8px padding-->
    <div class="p-2 w-full h-full flex flex-row justify-between items-start">
        <!--  Panels have screen minus the height of navbar plus padding -->
        <div
            class="flex flex-col gap-2 shrink-0 grow-0 w-[320px] min-w-[320px] max-w-[90vw] {innerTableHeight}"
        >
            <div
                class="max-sm:hidden shrink-0 grow-0 p-2 rounded-lg border-2 border-[#634a11] bg-transparent h-[44px]"
            >
                <HistoryControls enabledColor="text-[#634a11]" disabledColor="text-[#cabb7a]" />
            </div>
            <Tabs
                tabStyle="pill"
                classes={{
                    content: 'p-0 mt-0 dark:bg-transparent h-full overflow-auto rounded-lg'
                }}
            >
                <TabItem
                    open
                    onclick={onNonChatClick}
                    activeClass={activeTabClasses}
                    inactiveClass={inactiveTabClasses}
                >
                    {#snippet titleSlot()}
                        <div class="flex items-center gap-2 uppercase kaivai-font">
                            <UserCircleSolid size="md" />
                            Players
                        </div>
                    {/snippet}

                    <PlayersPanel />
                </TabItem>
                <TabItem
                    onclick={onNonChatClick}
                    activeClass={activeTabClasses}
                    inactiveClass={inactiveTabClasses}
                >
                    {#snippet titleSlot()}
                        <div class="flex items-center gap-2 uppercase kaivai-font">
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
                            <div class="flex items-center gap-2 uppercase kaivai-font">
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

                        <GameChat
                            height={'h-[calc(100dvh-202px)] sm:h-[calc(100dvh-178px)]'}
                            timeColor={'text-[#8d794d]'}
                            bgColor={'bg-[#302408]'}
                            inputBgColor={'bg-[#634a11]'}
                            inputBorderColor={'border-[#302408]'}
                        />
                    </TabItem>
                {/if}
            </Tabs>
        </div>
        <div
            class="ms-2 pe-2 sm:pe-0 shrink grow sm:min-w-[320px] min-w-[90vw] {innerTableHeight} flex flex-col"
        >
            <!--  Top part is not allowed to shrink -->
            <div class="shrink-0">
                <Phase />

                {#if gameSession.mode === GameSessionMode.History}
                    <LastHistoryDescription />
                {:else if gameSession.gameState.result}
                    <EndOfGamePanel />
                {:else if gameSession.mode === GameSessionMode.Play}
                    <LastHistoryDescription />
                    {#if gameSession.isMyTurn}
                        <ActionPanel />
                    {:else}
                        <WaitingPanel />
                    {/if}
                {/if}
            </div>
            <!--  Bottom part fills the remaining space, but hides overflow to keep it's height fixed.
              This allows the wrapper to scale to its bounds regardless of its content size-->
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify={'center'} controls={'bottom-left'}>
                    <div class="w-fit h-fit">
                        {#if showBidBoard}
                            <BidBoard />
                        {/if}
                        <Board />
                    </div>
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
        font-family: 'stacatto';
        src: url('/stacatto222bt.woff') format('woff');
    }

    :global(.kaivai-font) {
        font-family: 'stacatto', ui-sans-serif, system-ui, sans-serif;
    }

    :global(.text-shadow) {
        text-shadow: 2px 3px 6px black;
    }
</style>
