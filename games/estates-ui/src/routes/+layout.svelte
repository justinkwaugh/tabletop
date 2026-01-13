<script module lang="ts">
    import {
        createHarnessAppContext,
        setAppContext,
        type GameUiDefinition
    } from '@tabletop/frontend-components'
    import TimeAgo from 'javascript-time-ago'
    import en from 'javascript-time-ago/locale/en'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { UiDefinition } from '../lib/definition/gameUiDefinition.js'

    TimeAgo.addDefaultLocale(en)

    const definition = UiDefinition as unknown as GameUiDefinition<GameState, HydratedGameState>
</script>

<script lang="ts">
    let { children } = $props()
    setAppContext(createHarnessAppContext(definition))
</script>

{@render children()}
