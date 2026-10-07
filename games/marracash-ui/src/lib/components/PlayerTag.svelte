<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'

    let { playerId }: { playerId: string } = $props()
</script>

<!-- As a block the tag is only as tall as its line height, not the font's tall content area,
     so tags on wrapped lines and the header above keep clear of it. -->
<PlayerName {playerId} additionalClasses="inline-block leading-[1.2] px-1.5" />
