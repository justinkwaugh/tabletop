<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import { describeAction, describeSystemAction } from '$lib/utils/actionDescription.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { action }: { action: GameAction } = $props()

    const gameSession = getGameSession()
    const playerId = $derived(action.playerId)
    const text = $derived(
        playerId
            ? describeAction(action, playerId === gameSession.myPlayer?.id ? 'your' : 'their')
            : describeSystemAction(action)
    )
</script>

{#if text}
    <span>
        {#if playerId}<PlayerName {playerId} />{' '}{/if}{text}
    </span>
{/if}
