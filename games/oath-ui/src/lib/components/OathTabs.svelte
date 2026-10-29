<script lang="ts">
    import { onMount, type Snippet } from 'svelte'
    import { Tabs, TabItem, Indicator } from 'flowbite-svelte'
    import {
        AnnotationSolid,
        BookOpenSolid,
        ClockSolid,
        UserCircleSolid
    } from 'flowbite-svelte-icons'
    import { GameToaster, toastNewChatMessages } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // The platform's three tabs, Players, History and Chat, as `DefaultTabs` draws them, with the
    // chronicle's record as a fourth once it holds an entry. Chat's unread dot and its toasts follow
    // the platform's rule: unread messages, unless Chat is the open tab.
    let {
        playersPanel,
        history,
        chronicle,
        chronicleShown,
        chat,
        activeTabClass,
        inactiveTabClass
    }: {
        playersPanel: Snippet
        history: Snippet
        chronicle: Snippet
        /** The state on screen holds a record entry. */
        chronicleShown: boolean
        chat: Snippet
        activeTabClass: string
        inactiveTabClass: string
    } = $props()

    let gameSession = getGameSession()

    let chatActive = $state(false)
    let showNewMessageIndicator = $derived(gameSession.hasUnreadMessages && !chatActive)

    // The Chronicle tab stays while it is the open one, so stepping the History back before the
    // record's first entry leaves it open on the state shown, with no entry; it leaves when another
    // tab is opened.
    let chronicleActive = $state(false)
    let chronicleTab = $derived(chronicleShown || chronicleActive)

    function opened(tab: 'chat' | 'chronicle' | 'other') {
        chatActive = tab === 'chat'
        chronicleActive = tab === 'chronicle'
    }

    // Four tabs fit the side column on one line, at a desktop's width and a phone's: their names
    // alone, a little closer together.
    let four = $derived(chronicleTab)
    let activeClasses = $derived(`relative box-border ${narrowed(activeTabClass)}`)
    let inactiveClasses = $derived(`relative box-border ${narrowed(inactiveTabClass)}`)

    function narrowed(classes: string): string {
        return four ? classes.replace(/\bpx-3\b/, 'px-2') : classes
    }

    onMount(() => toastNewChatMessages(gameSession, () => chatActive))
</script>

{#snippet title(label: string, Icon: typeof ClockSolid)}
    <div class="flex items-center gap-2" class:tabs--four={four}>
        <span class="tab-icon"><Icon size="md" /></span>
        {label}
    </div>
{/snippet}

<GameToaster />
<Tabs
    tabStyle="pill"
    classes={{ content: 'p-0 mt-0 dark:bg-transparent h-full overflow-auto rounded-lg' }}
>
    <TabItem
        open
        onclick={() => opened('other')}
        activeClass={activeClasses}
        inactiveClass={inactiveClasses}
    >
        {#snippet titleSlot()}{@render title('Players', UserCircleSolid)}{/snippet}
        {@render playersPanel()}
    </TabItem>
    <TabItem
        onclick={() => opened('other')}
        activeClass={activeClasses}
        inactiveClass={inactiveClasses}
    >
        {#snippet titleSlot()}{@render title('History', ClockSolid)}{/snippet}
        {@render history()}
    </TabItem>
    {#if chronicleTab}
        <TabItem
            onclick={() => opened('chronicle')}
            activeClass={activeClasses}
            inactiveClass={inactiveClasses}
        >
            {#snippet titleSlot()}{@render title('Chronicle', BookOpenSolid)}{/snippet}
            {@render chronicle()}
        </TabItem>
    {/if}
    {#if gameSession.chatAvailable}
        <TabItem
            onclick={() => opened('chat')}
            activeClass={activeClasses}
            inactiveClass={inactiveClasses}
        >
            {#snippet titleSlot()}
                <div class="flex items-center gap-2" class:tabs--four={four}>
                    <span class="tab-icon"><AnnotationSolid size="md" /></span>
                    Chat
                    {#if showNewMessageIndicator}
                        <Indicator
                            color="red"
                            size="lg"
                            placement="top-right"
                            class="-end-0.5 text-xs font-bold text-white w-4 h-4 border border-oath-text"
                        ></Indicator>
                    {/if}
                </div>
            {/snippet}
            {@render chat()}
        </TabItem>
    {/if}
</Tabs>

<style>
    .tabs--four .tab-icon {
        display: none;
    }
</style>
