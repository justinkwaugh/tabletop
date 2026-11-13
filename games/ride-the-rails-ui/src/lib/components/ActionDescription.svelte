<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import { describeAction } from '$lib/utils/describeAction.js'
    import Description from './Description.svelte'

    let {
        action,
        justify = 'start'
    }: { action: GameAction; justify?: 'start' | 'center' | 'end' } = $props()

    // Built from the action's input and metadata alone (docs/game-ui-layout.md, History panel).
    const description = $derived(describeAction(action))
</script>

<span
    class="inline-flex flex-wrap items-baseline gap-y-1"
    class:justify-start={justify === 'start'}
    class:justify-center={justify === 'center'}
    class:justify-end={justify === 'end'}
>
    <Description {description} />
</span>
