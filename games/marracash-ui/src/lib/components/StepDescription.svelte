<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import { isEndTurn } from '@tabletop/marracash'
    import ActionDescription from '$lib/components/ActionDescription.svelte'
    import PlayerTag from '$lib/components/PlayerTag.svelte'

    let { actions }: { actions: readonly GameAction[] } = $props()

    let described = $derived(actions.filter((action) => !isEndTurn(action)))
</script>

{#each described as action (action.id)}
    <span
        >{#if action.playerId}<PlayerTag playerId={action.playerId} />{' '}{/if}<ActionDescription
            {action}
            detail={false}
        /></span
    >{' '}
{/each}
