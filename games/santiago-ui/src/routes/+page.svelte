<script lang="ts">
    import { type GameUiDefinition } from '@tabletop/frontend-components'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { UiDefinition } from '../lib/definition/gameUiDefinition.js'
    import { Harness } from '@tabletop/frontend-components'
    import '../app.css'
    const definition = UiDefinition as unknown as GameUiDefinition<GameState, HydratedGameState>
</script>

<Harness {definition} />
