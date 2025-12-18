<script lang="ts">
    import { getContext } from 'svelte'
    import JSONTree from 'svelte-json-tree'
    import { Tabs, TabItem } from 'flowbite-svelte'
    import type { GameSession } from '../model/gameSession.svelte'
    import type { GameState, HydratedGameState } from '@tabletop/common'

    let gameSession = getContext('gameSession') as GameSession<GameState, HydratedGameState>
</script>

<div
    class="rounded-lg dark:bg-black space-y-2 text-left ms-2 p-4 sm:h-[calc(100dvh-84px)] h-[calc(100dvh-116px)] overflow-auto"
>
    <Tabs tabStyle="pill" divider={false} classes={{ content: 'dark:bg-gray-200 rounded-lg p-2' }}>
        <TabItem open title="Game">
            <div style="--json-tree-font-size: 14px;">
                <JSONTree value={gameSession.game} />
            </div>
        </TabItem>
        <TabItem title="State">
            <div style="--json-tree-font-size: 14px;">
                <JSONTree value={gameSession.gameState.dehydrate()} />
            </div>
        </TabItem>
        <TabItem title="Actions">
            <div style="--json-tree-font-size: 14px;">
                <JSONTree value={gameSession.actions.toReversed()} />
            </div>
        </TabItem>
    </Tabs>
</div>
