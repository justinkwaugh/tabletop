<script lang="ts">
    import type { GameAction } from '@tabletop/common'

    let { action }: { action: GameAction } = $props()
</script>

<span>{action.type}</span>
