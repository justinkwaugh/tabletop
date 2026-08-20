<script lang="ts">
    import { type GameUiDefinition } from '@tabletop/frontend-components'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { UiDefinition } from '../lib/definitions/definition.js'
    import { Harness } from '@tabletop/frontend-components'
    const definition = UiDefinition as unknown as GameUiDefinition<GameState, HydratedGameState>
</script>

<Harness {definition} />
