<script lang="ts">
    import { Harness, type GameUiDefinition } from '@tabletop/frontend-components'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { UiDefinition } from '../lib/index.js'
    import '../app.css'
    const definition = UiDefinition as unknown as GameUiDefinition<GameState, HydratedGameState>
</script>

<svelte:head><title>The Old Prince 1871 — Development</title></svelte:head>

<Harness {definition} />
