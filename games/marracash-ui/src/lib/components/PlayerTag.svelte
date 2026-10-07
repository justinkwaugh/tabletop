<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'

    let { playerId }: { playerId: string } = $props()
</script>

<PlayerName {playerId} />
