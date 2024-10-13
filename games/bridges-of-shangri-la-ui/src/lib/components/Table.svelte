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
    import type { BridgesGameSession } from '$lib/model/BridgesGameSession.svelte'
    import WaitingPanel from '$lib/components/WaitingPanel.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import { Indicator, TabItem, Tabs } from 'flowbite-svelte'
    import { UserCircleSolid, ClockSolid, AnnotationSolid } from 'flowbite-svelte-icons'
    import { toast } from 'svelte-sonner'

    let gameSession = getContext('gameSession') as BridgesGameSession
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
                    playerBgColor: gameSession.getPlayerBgColor(event.message.playerId),
                    playerTextColor: gameSession.getPlayerTextColor(event.message.playerId)
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
</script>

<div
    class="sm:hidden shrink-0 grow-0 p-2 h-[42px] flex flex-col justify-center items-center border-gray-700 border-b-2"
>
    <HistoryControls />
</div>
<!-- Full Height and Width with 8px padding-->
<div bind:this={table} class="flex w-screen overflow-auto max-sm:h-[calc(100vh-142px)]">
    <div class="p-2 w-full h-full flex flex-row justify-between items-start">
        <!--  Panels have screen minus the height of navbar plus padding -->
        <div
            class="flex flex-col space-y-2 shrink-0 grow-0 w-[320px] min-w-[320px] max-w-[90vw] sm:h-[calc(100dvh-84px)] h-[calc(100dvh-158px)]"
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
            </Tabs>
        </div>
        <div
            class="ms-2 pe-2 sm:pe-0 shrink grow sm:min-w-[320px] min-w-[90vw] sm:h-[calc(100dvh-84px)] h-[calc(100dvh-158px)] flex flex-col"
        >
            <!--  Top part is not allowed to shrink -->
            <div class="shrink-0">
                {#if gameSession.gameState.result}
                    <GameEndPanel />
                {:else if gameSession.mode === GameSessionMode.Play}
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
