<script lang="ts">
    import { getContext } from 'svelte'
    import JSONTree from 'svelte-json-tree'
    import { Tabs, TabItem } from 'flowbite-svelte'
    import type { GameSession } from '../model/gameSession.svelte'

    let gameSession = getContext('gameSession') as GameSession
</script>

<div
    class="rounded-lg bg-black space-y-2 text-left ms-2 p-4 sm:h-[calc(100vh-84px)] h-[calc(100vh-116px)] overflow-scroll"
>
    <Tabs tabStyle="underline" divider={false} contentClass="bg-gray-200 rounded-lg p-2">
        <TabItem open title="Game">
            <div style="--json-tree-font-size: 14px;">
                <JSONTree value={gameSession.game} />
            </div>
        </TabItem>
        <TabItem title="State">
            <div style="--json-tree-font-size: 14px;">
                <JSONTree value={gameSession.visibleGameState} />
            </div>
        </TabItem>
        <TabItem title="Actions">
            <div style="--json-tree-font-size: 14px;">
                <JSONTree value={gameSession.actions} />
            </div>
        </TabItem>
    </Tabs>
</div>
