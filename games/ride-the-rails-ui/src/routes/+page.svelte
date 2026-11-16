<script lang="ts">
    import type { GameUiDefinition } from '@tabletop/frontend-components'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { Harness } from '@tabletop/frontend-components'
    import { UiDefinition } from '../lib/index.js'
    import '../app.css'
    const definition = UiDefinition as unknown as GameUiDefinition<GameState, HydratedGameState>
</script>

<svelte:head><title>Ride the Rails</title></svelte:head>
<Harness {definition} />
