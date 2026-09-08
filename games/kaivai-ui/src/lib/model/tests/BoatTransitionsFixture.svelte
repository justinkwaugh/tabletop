<script lang="ts">
    import { untrack } from 'svelte'
    import type { KaivaiGameSession } from '../KaivaiGameSession.svelte.js'
    import { setGameSession } from '../gameSessionContext.svelte.js'
    import Board from '../../components/Board.svelte'
    import ActionPanel from '../../components/ActionPanel.svelte'
    import Phase from '../../components/Phase.svelte'

    const {
        session,
        fixedControls = true
    }: { session: KaivaiGameSession; fixedControls?: boolean } = $props()
    setGameSession(untrack(() => session))
</script>

<div data-testid="boat-fixture" data-updating={session.updatingVisibleState}>
    <Phase />
    <div style={fixedControls ? 'height: 160px; overflow: hidden' : undefined}>
        <span data-testid="chosen-action">{session.chosenAction ?? ''}</span>
        <span data-testid="action-source">{session.chosenActionSource ?? ''}</span>
        <div data-testid="action-panel"><ActionPanel /></div>
    </div>
    <Board />
</div>
