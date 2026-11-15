<script lang="ts">
    import { isCallGameAction, type GameAction } from '@tabletop/common'
    import { CalledGameDescription, PlayerName } from '@tabletop/frontend-components'
    import { nanoid } from 'nanoid'

    let {
        action,
        justify = 'start',
        history = true
    }: { action: GameAction; justify?: 'start' | 'center' | 'end'; history?: boolean } = $props()
</script>

{#if isCallGameAction(action)}
    <CalledGameDescription {action} />
{:else}
    Action Description
{/if}
