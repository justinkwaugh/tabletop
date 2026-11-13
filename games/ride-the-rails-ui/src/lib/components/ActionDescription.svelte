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

<!-- Inline text flow, not flex: a flex container drops the spaces at the ends of its segments. -->
<span
    class="inline"
    class:text-left={justify === 'start'}
    class:text-center={justify === 'center'}
    class:text-right={justify === 'end'}
>
    <Description {description} />
</span>
