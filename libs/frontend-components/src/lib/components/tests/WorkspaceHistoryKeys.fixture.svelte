<script lang="ts">
    import { TabWorkspace, HistoryKeyControls, type WorkspaceTab } from '../../index.js'
    import { setGameSession } from '../../model/gameSessionContext.js'
    import type { GameSessionView } from '../../model/gameSessionView.js'

    let steps: string[] = $state([])
    setGameSession({
        myPlayer: undefined,
        isBusy: () => false,
        history: {
            goToPreviousAction: () => steps.push('previous'),
            goToNextAction: () => steps.push('next')
        }
    } as unknown as GameSessionView)

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
<output aria-label="History steps">{steps.join(',')}</output>
