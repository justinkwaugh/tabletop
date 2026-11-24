<script lang="ts">
    import { untrack } from 'svelte'
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import { setGameSession } from '$lib/model/gameSessionContext.js'
    import { TabWorkspace, HistoryKeyControls, type WorkspaceTab } from '../../index.js'

    let { session }: { session: GameSession<any, any> } = $props()
    setGameSession(untrack(() => session))

    const tabs: WorkspaceTab[] = [
        { id: 'actions', label: 'Actions', closable: false },
        { id: 'order', label: 'Order', closable: false }
    ]
</script>

<HistoryKeyControls />
<button type="button">Before the workspace</button>
<div style="height: 300px">
    <TabWorkspace {tabs} splittable={false} label="Example">
        {#snippet children(id)}<p>{id} content</p>{/snippet}
    </TabWorkspace>
</div>
<output aria-label="History position"
    >{session.isViewingHistory ? session.history.actionIndex : 'live'}</output
>
