<script lang="ts">
    import type { Game, GameState, HydratedGameState } from '@tabletop/common'
    import { setAppContext, type AppContext } from '$lib/model/appContext.js'
    import type { GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
    import GameEditForm from '../GameEditForm.svelte'

    let {
        app,
        title,
        onsave
    }: {
        app: AppContext
        title: GameUiDefinition<GameState, HydratedGameState>
        onsave: (game: Game) => void
    } = $props()

    setAppContext(app)
</script>

<GameEditForm {title} showHeading={false} oncancel={() => {}} {onsave} />
