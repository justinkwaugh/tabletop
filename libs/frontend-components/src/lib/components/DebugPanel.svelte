<script lang="ts">
    import JsonInspector from './JsonInspector.svelte'
    import { Tabs, TabItem } from 'flowbite-svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.js'
    import PrivilegedGameViewControl from './PrivilegedGameViewControl.svelte'

    let gameSession = getGameSession()
    const { myPlayer, privilegedGameView } = gameSession.bridge

    const tabClasses = {
        button: 'px-2.5 py-1.5 text-xs leading-4 font-medium rounded-none border-b-2 bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400'
    }
    const activeTabClass =
        'text-slate-900 border-slate-500 dark:text-slate-100 dark:border-slate-300'
    const inactiveTabClass =
        'text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
</script>

<div class="bg-slate-950 space-y-2 text-left ms-2 sm:h-[calc(100dvh-84px)] h-[calc(100dvh-116px)] overflow-auto">
    {#if privilegedGameView}
        <div class="flex items-center gap-2">
            <PrivilegedGameViewControl view={privilegedGameView} actingPlayer={myPlayer} />
        </div>
    {/if}
    <Tabs
        tabStyle="underline"
        divider={false}
        class="space-x-1 border-b border-slate-200 dark:border-slate-800"
        classes={{ content: 'p-0 mt-2 rounded-none bg-transparent dark:bg-transparent' }}
    >
        <TabItem
            open
            title="Game"
            classes={tabClasses}
            activeClass={activeTabClass}
            inactiveClass={inactiveTabClass}
        >
            <JsonInspector label="Game" value={gameSession.game} />
        </TabItem>
        <TabItem
            title="State"
            classes={tabClasses}
            activeClass={activeTabClass}
            inactiveClass={inactiveTabClass}
        >
            <JsonInspector label="State" value={gameSession.gameState.dehydrate()} />
        </TabItem>
        <TabItem
            title="Actions"
            classes={tabClasses}
            activeClass={activeTabClass}
            inactiveClass={inactiveTabClass}
        >
            <JsonInspector label="Actions" value={gameSession.actions.toReversed()} />
        </TabItem>
    </Tabs>
</div>
