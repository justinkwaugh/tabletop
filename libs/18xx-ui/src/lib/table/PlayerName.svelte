<script lang="ts">
    let { name, color, dotSize = 14, maxWidth = '140px' }: { name: string; color: string; dotSize?: number; maxWidth?: string } = $props()
</script>
<span class="player-label" title={name} style:max-width={maxWidth}>
    <span class="color-dot" style:background={color} style:width={`${dotSize}px`} style:height={`${dotSize}px`} aria-hidden="true"></span>
    <span class="name">{name}</span>
</span>
<style>
    .player-label { display: inline-flex; align-items: center; gap: 5px; vertical-align: middle; }
    .color-dot { flex-shrink: 0; border-radius: 50%; }
    .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
