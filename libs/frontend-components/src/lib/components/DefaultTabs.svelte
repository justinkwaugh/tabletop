<script lang="ts">
    import {
        GameChat,
        type ChatEvent,
        ChatEventType,
        GameSession,
        ChatToast
    } from '@tabletop/frontend-components'

    import { getContext, onMount, type ComponentType, type Snippet } from 'svelte'
    import { Tabs, TabItem, Indicator } from 'flowbite-svelte'
    import { UserCircleSolid, ClockSolid, AnnotationSolid } from 'flowbite-svelte-icons'
    import { toast } from 'svelte-sonner'
    import type { GameState, HydratedGameState } from '@tabletop/common'

    let {
        history,
        playersPanel,
        chat,
        playersTitle,
        historyTitle,
        chatTitle,
        fontClass = '',
        activeTabClass,
        inactiveTabClass
    }: {
        history?: Snippet
        playersPanel?: Snippet
        chat?: Snippet
        playersTitle?: string
        historyTitle?: string
        chatTitle?: string
        fontClass?: string
        activeTabClass?: string
        inactiveTabClass?: string
    } = $props()

    let gameSession = getContext('gameSession') as GameSession<GameState, HydratedGameState>

    let chatActive: boolean = $state(false)
    let showNewMessageIndicator: boolean = $derived(
        gameSession.myPlayer !== undefined &&
            gameSession.chatService.hasUnreadMessages &&
            !chatActive
    )

    let activeTabClasses = `relative box-border ${activeTabClass ?? 'py-1 px-3 bg-gray-300 border-2 border-transparent rounded-lg text-gray-900'}`
    let inactiveTabClasses = `relative box-border ${inactiveTabClass ?? 'text-gray-200 py-1 px-3 rounded-lg border-2 border-transparent hover:border-gray-700'}`

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
</script>

<Tabs
    tabStyle="pill"
    classes={{
        content: 'p-0 mt-0 dark:bg-transparent h-full overflow-auto rounded-lg'
    }}
>
    {#if playersPanel}
        <TabItem
            open
            onclick={onNonChatClick}
            activeClass={activeTabClasses}
            inactiveClass={inactiveTabClasses}
        >
            {#snippet titleSlot()}
                <div class="flex items-center gap-2 {fontClass}">
                    <UserCircleSolid size="md" />
                    {playersTitle ?? 'Players'}
                </div>
            {/snippet}
            {#if playersPanel}
                {@render playersPanel()}
            {/if}
        </TabItem>
    {/if}
    {#if history}
        <TabItem
            onclick={onNonChatClick}
            activeClass={activeTabClasses}
            inactiveClass={inactiveTabClasses}
        >
            {#snippet titleSlot()}
                <div class="flex items-center gap-2 {fontClass}">
                    <ClockSolid size="md" />
                    {historyTitle ?? 'History'}
                </div>
            {/snippet}
            {#if history}
                {@render history()}
            {/if}
        </TabItem>
    {/if}
    {#if !gameSession.primaryGame.hotseat}
        <TabItem
            onclick={onChatClick}
            activeClass={activeTabClasses}
            inactiveClass={inactiveTabClasses}
        >
            {#snippet titleSlot()}
                <div class="flex items-center gap-2 {fontClass}">
                    <AnnotationSolid size="md" />
                    {chatTitle ?? 'Chat'}
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
            {#if chat}
                {@render chat()}
            {:else}
                <GameChat />
            {/if}
        </TabItem>
    {/if}
</Tabs>
