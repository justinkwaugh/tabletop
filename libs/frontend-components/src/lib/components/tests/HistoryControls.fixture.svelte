<script lang="ts">
    import { untrack } from 'svelte'
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import { setGameSession } from '$lib/model/gameSessionContext.js'
    import HistoryControls from '../HistoryControls.svelte'
    let { session, complete }: { session: GameSession<any, any>; complete: () => void } = $props()
    setGameSession(untrack(() => session))
</script>

<div data-testid="history-controls" style="width: 400px">
    <HistoryControls enabledColor="text-orange-400" />
</div>
<button onclick={complete}>Complete history</button>
