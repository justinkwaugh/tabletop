<script lang="ts">
    import { getContext } from 'svelte'
    import type { GameSession } from '$lib/model/gameSession.svelte.ts'
    import type { GameState, HydratedGameState } from '@tabletop/common'

    let {
        playerId,
        possessive = false,
        capitalization = 'capitalize'
    }: {
        playerId?: string
        possessive?: boolean
        capitalization?: 'none' | 'capitalize' | 'uppercase' | 'lowercase'
    } = $props()

    let gameSession = getContext('gameSession') as GameSession<GameState, HydratedGameState>

    let text = $derived.by(() => {
        if (playerId === gameSession.myPlayer?.id) {
            return 'you' + (possessive ? 'r' : '')
        } else {
            return gameSession.getPlayerName(playerId) + (possessive ? "'s" : '')
        }
    })
</script>

<span
    class="rounded px-2 {gameSession.colors.getPlayerBgColor(
        playerId
    )} font-medium {gameSession.colors.getPlayerTextColor(playerId)} {capitalization ===
    'capitalize'
        ? 'capitalize'
        : capitalization === 'uppercase'
          ? 'uppercase'
          : capitalization === 'lowercase'
            ? 'lowercase'
            : ''}">{text}</span
>
