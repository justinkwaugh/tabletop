<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState, cityInfo } from '@tabletop/kogge'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/story.js'
    import StoryLine from '../ui/StoryLine.svelte'

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const actorId = $derived(game.activePlayerIds[0])
    const doing = $derived.by(() => {
        switch (game.machineState) {
            case MachineState.TakingTurn:
                return game.turn?.movementDone
                    ? `is trading in ${game.turn ? cityInfo(game.getPlayerState(game.turn.playerId).location()).name : ''}`
                    : 'is sailing'
            case MachineState.DividingSpoils:
                return 'is splitting their cargo for the robber'
            case MachineState.ChoosingSpoils:
                return 'is choosing a pile of loot'
            case MachineState.ExpellingRaider:
                return 'chooses where the robber is sent'
            default:
                return 'is deciding'
        }
    })
    const recent = $derived(
        gameSession.actions
            .slice(-6)
            .map((action) => describeAction(action))
            .filter((story) => story !== undefined)
            .slice(-2)
    )
</script>

<div class="flex flex-col gap-1">
    <div class="kogge-prompt inline-flex gap-1">
        <PlayerName playerId={actorId} /> <span>{doing}</span>
    </div>
    {#each recent as story, index (index)}
        <div class="text-sm text-[#5b4027]"><StoryLine {story} /></div>
    {/each}
</div>
