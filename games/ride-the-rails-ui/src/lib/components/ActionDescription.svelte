<script lang="ts">
    import type { GameAction } from '@tabletop/common'

    let {
        action,
        justify = 'start',
        history = true
    }: { action: GameAction; justify?: 'start' | 'center' | 'end'; history?: boolean } = $props()
</script>

Action Description
