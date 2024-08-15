<script lang="ts">
    import { getContext } from 'svelte'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import JSONTree from 'svelte-json-tree'
    import { Tabs, TabItem } from 'flowbite-svelte'

    let gameSession = getContext('gameSession') as FreshFishGameSession
</script>

<div class="rounded-lg bg-black space-y-2 text-left ms-2 p-4 h-[calc(100vh-76px)] overflow-scroll">
    <Tabs tabStyle="underline" divider={false} contentClass="bg-gray-200 rounded-lg p-2">
        <TabItem open title="Game">
            <div style="--json-tree-font-size: 14px;">
                <JSONTree value={gameSession.game} />
            </div>
        </TabItem>
        <TabItem title="State">
            <div style="--json-tree-font-size: 14px;">
                <JSONTree value={gameSession.gameState} />
            </div>
        </TabItem>
        <TabItem title="Actions">
            <div style="--json-tree-font-size: 14px;">
                <JSONTree value={gameSession.actions} />
            </div>
        </TabItem>
    </Tabs>
</div>
