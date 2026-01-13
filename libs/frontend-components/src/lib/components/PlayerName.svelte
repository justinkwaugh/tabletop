<script lang="ts">
    import { getGameSession } from '$lib/model/gameSessionContext.js'

    let {
        playerId,
        possessivePlayerId,
        possessive = false,
        plainSelfPossessive = false,
        capitalization = 'capitalize',
        fontFamily = 'inherit',
        additionalClasses = ''
    }: {
        playerId?: string
        possessivePlayerId?: string
        possessive?: boolean
        plainSelfPossessive?: boolean
        capitalization?: 'none' | 'capitalize' | 'uppercase' | 'lowercase'
        fontFamily?: string
        additionalClasses?: string
    } = $props()

    let gameSession = getGameSession()

    let text = $derived.by(() => {
        if (playerId === gameSession.myPlayer?.id) {
            return 'you' + (possessive ? 'r' : '')
        } else if (possessive && playerId === possessivePlayerId) {
            return 'their'
        } else {
            return gameSession.getPlayerName(playerId) + (possessive ? "'s" : '')
        }
    })
</script>

{#if possessive && plainSelfPossessive && (playerId === gameSession.myPlayer?.id || playerId === possessivePlayerId)}
    {text}
{:else}
    <span
        style="font-family:{fontFamily}"
        class="rounded px-2 {gameSession.colors.getPlayerBgColor(
            playerId
        )} font-medium {gameSession.colors.getPlayerTextColor(playerId)} {capitalization ===
        'capitalize'
            ? 'capitalize'
            : capitalization === 'uppercase'
              ? 'uppercase'
              : capitalization === 'lowercase'
                ? 'lowercase'
                : ''} {additionalClasses}">{text}</span
    >
{/if}
