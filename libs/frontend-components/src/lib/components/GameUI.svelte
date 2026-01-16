<script lang="ts">
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import { attachDynamicComponent } from '$lib/utils/dynamicComponent.js'
    import type { GameState, HydratedGameState } from '@tabletop/common'

    let { gameSession }: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
</script>

<div {@attach attachDynamicComponent(gameSession.runtime.gameUI, { gameSession })}></div>
