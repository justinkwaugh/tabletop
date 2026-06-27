<script lang="ts">
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import ExplorationPanel from './ExplorationPanel.svelte'
    import HistoryKeyControls from './HistoryKeyControls.svelte'
    import { setGameSession } from '$lib/model/gameSessionContext.js'
    import GameUI from './GameUI.svelte'
    import { attachGlobalCssVarFromRect } from '$lib/utils/publishCssVarFromRect.js'

    let { gameSession }: { gameSession: GameSession<GameState, HydratedGameState> } = $props()

    // svelte-ignore state_referenced_locally
    setGameSession(gameSession)
</script>

<HistoryKeyControls />

<div {@attach attachGlobalCssVarFromRect('--app-banner-height')}>
    {#if gameSession.isExploring}
        <ExplorationPanel />
    {/if}
</div>
<GameUI {gameSession} />
