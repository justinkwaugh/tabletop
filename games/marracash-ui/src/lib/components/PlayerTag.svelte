<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'

    let { playerId }: { playerId: string } = $props()
</script>

<PlayerName {playerId} additionalClasses="ring-1 ring-[#ad9c80]" />
