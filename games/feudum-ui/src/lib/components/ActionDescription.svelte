<script lang="ts">
    import { isCallGameAction, type GameAction } from '@tabletop/common'
    import { CalledGameDescription } from '@tabletop/frontend-components'
    import LogPlayerName from '$lib/components/LogPlayerName.svelte'
    import TokenText from '$lib/components/pieces/TokenText.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    /** One Action's line in the log (contract: Game log and history), led by who took it. */
    let { action, viewerId }: { action: GameAction; viewerId?: string } = $props()

    const gameSession = getGameSession()

    let viewer = $derived(viewerId ?? gameSession.myPlayerId)
    let actionLine = $derived(gameSession.actionLine(action, viewer))
    let leadWord = $derived.by(() => {
        const { playerId } = action
        if (!playerId) {
            return undefined
        }
        return playerId === viewer ? 'You' : gameSession.getPlayerName(playerId)
    })
    let led = $derived(leadWord !== undefined && actionLine?.startsWith(`${leadWord} `) === true)
    let rest = $derived(led && leadWord ? actionLine?.slice(leadWord.length) : actionLine)
</script>

{#if actionLine}
    <span data-action-line={actionLine}>
        {#if led && action.playerId}<LogPlayerName
                playerId={action.playerId}
                viewerId={viewer}
            />{/if}<TokenText text={rest ?? ''} />
    </span>
{:else if isCallGameAction(action)}
    <CalledGameDescription {action} />
{/if}
