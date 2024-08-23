<script lang="ts">
    import bridge from '$lib/images/bridge.png'

    let { location, rotation, visible }: { location: string; rotation: string; visible: boolean } =
        $props()
</script>

<div class="absolute {location}">
    <img class="h-[75px] {rotation} {!visible ? 'hidden' : ''}" src={bridge} alt="bridge" />
</div>
