<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'

    let { playerId }: { playerId: string } = $props()
</script>

<!-- As a block the tag is only as tall as its line height, not the font's tall content area,
     so tags on wrapped lines and the header above keep clear of it. Tags are always set in El
     Messiri, whatever the text around them. Its capitals sit high in the line, so part of the
     line height moves into top padding: the tag stays 1.2em tall with its capitals centred. -->
<PlayerName
    {playerId}
    additionalClasses="marracash-merchant inline-block leading-[0.94em] pt-[0.26em] px-1.5"
/>
