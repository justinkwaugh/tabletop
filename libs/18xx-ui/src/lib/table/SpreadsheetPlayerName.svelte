<script lang="ts">
    let { name, color }: { name: string; color: string } = $props()
</script>
<span class="player-label" title={name}>
    <span class="color-dot" style:background={color} aria-hidden="true"></span>
    <span class="name">{name}</span>
</span>
<style>
    .player-label { display: inline-flex; align-items: center; gap: 5px; max-width: 140px; vertical-align: middle; }
    .color-dot { width: 14px; height: 14px; flex-shrink: 0; border-radius: 50%; }
    .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
