<script lang="ts">
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import { attachDynamicComponent } from '$lib/utils/dynamicComponent.js'
    import type { GameState, HydratedGameState } from '@tabletop/common'

    let { gameSession }: { gameSession: GameSession<GameState, HydratedGameState> } = $props()

    const gameTypeClassSuffix = $derived.by(() => {
        const rawTypeId = gameSession.game.typeId ?? 'unknown'
        return rawTypeId
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
    })
</script>

<div
    class={`mfe-game-root mfe-game--${gameTypeClassSuffix}`}
    data-game-ui={gameTypeClassSuffix}
    {@attach attachDynamicComponent(gameSession.runtime.gameUI, { gameSession })}
></div>
