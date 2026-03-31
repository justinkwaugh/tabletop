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

    let baseText = $derived.by(() => {
        if (playerId === gameSession.myPlayer?.id) {
            return 'you'
        } else if (possessive && playerId === possessivePlayerId) {
            return 'their'
        } else {
            return gameSession.getPlayerName(playerId)
        }
    })

    let suffixText = $derived.by(() => {
        if (playerId === gameSession.myPlayer?.id) {
            return possessive ? 'r' : ''
        }
        if (possessive && playerId === possessivePlayerId) {
            return ''
        }
        return possessive ? "'s" : ''
    })

    let text = $derived(`${baseText}${suffixText}`)

    let transformClass = $derived(
        capitalization === 'uppercase'
            ? 'uppercase'
            : capitalization === 'lowercase'
              ? 'lowercase'
              : ''
    )
</script>

{#if possessive && plainSelfPossessive && (playerId === gameSession.myPlayer?.id || playerId === possessivePlayerId)}
    {text}
{:else}
    <span
        style="font-family:{fontFamily}"
        style:background-color={gameSession.colors.getPlayerBgColorValue(playerId)}
        style:color={gameSession.colors.getPlayerTextColorValue(playerId)}
        class="rounded px-2 font-medium {transformClass} {additionalClasses}"
    >
        {#if capitalization === 'capitalize'}
            <span class="capitalize">{baseText}</span>{suffixText}
        {:else}
            {text}
        {/if}</span
    >
{/if}
