<script lang="ts">
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import HotseatPanel from './HotseatPanel.svelte'
    import ExplorationPanel from './ExplorationPanel.svelte'
    import HistoryKeyControls from './HistoryKeyControls.svelte'
    import { setGameSession } from '$lib/model/gameSessionContext.js'
    import GameUI from './GameUI.svelte'
    import { attachGlobalCssVarFromRect } from '$lib/utils/publishCssVarFromRect.js'

    let {
        gameSession,
        protectedMode = false
    }: { gameSession: GameSession<GameState, HydratedGameState>; protectedMode?: boolean } =
        $props()

    // svelte-ignore state_referenced_locally
    setGameSession(gameSession)
</script>

<HistoryKeyControls />

<div {@attach attachGlobalCssVarFromRect('--app-banner-height')}>
    {#if gameSession.isExploring}
        <ExplorationPanel />
    {:else if protectedMode && !gameSession.isViewingHost}
        <div class="p-2 text-center bg-gray-800 text-white">
            {#if gameSession.myPlayer}
                {gameSession.myPlayer.name} — {gameSession.isMyTurn
                    ? 'It’s your turn'
                    : 'Waiting for active player'}
            {:else}
                Spectator
            {/if}
        </div>
    {:else if gameSession.game.hotseat}
        <HotseatPanel />
    {/if}
</div>
<GameUI {gameSession} />
