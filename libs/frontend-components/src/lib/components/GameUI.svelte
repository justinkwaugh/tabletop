<script lang="ts">
    import type { GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import { attachDynamicComponent } from '$lib/utils/dynamicComponent.js'
    import type { GameState, HydratedGameState } from '@tabletop/common'

    let {
        definition,
        gameSession
    }: {
        definition: GameUiDefinition<GameState, HydratedGameState>
        gameSession: GameSession<GameState, HydratedGameState>
    } = $props()
</script>

<div {@attach attachDynamicComponent(definition.gameUI, { gameSession })}></div>
