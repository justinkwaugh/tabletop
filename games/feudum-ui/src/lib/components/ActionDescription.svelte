<script lang="ts">
    import { isCallGameAction, type GameAction } from '@tabletop/common'
    import { CalledGameDescription, PlayerName } from '@tabletop/frontend-components'
    import TokenText from '$lib/components/pieces/TokenText.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    /** One Action's line in the log (contract: Game log and history), led by who took it. */
    let { action }: { action: GameAction } = $props()

    const gameSession = getGameSession()

    let actionLine = $derived(gameSession.actionLine(action))
    let leadWord = $derived.by(() => {
        const { playerId } = action
        if (!playerId) {
            return undefined
        }
        return playerId === gameSession.myPlayerId ? 'You' : gameSession.getPlayerName(playerId)
    })
    let led = $derived(leadWord !== undefined && actionLine?.startsWith(`${leadWord} `) === true)
    let rest = $derived(led && leadWord ? actionLine?.slice(leadWord.length) : actionLine)
</script>

{#if actionLine}
    <span data-action-line={actionLine}>
        {#if led && action.playerId}<PlayerName playerId={action.playerId} />{/if}<TokenText
            text={rest ?? ''}
        />
    </span>
{:else if isCallGameAction(action)}
    <CalledGameDescription {action} />
{/if}
