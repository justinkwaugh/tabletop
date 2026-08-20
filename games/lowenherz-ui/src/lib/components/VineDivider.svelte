<script lang="ts">
    import vineDivider from '$lib/images/vine-divider.png'

    let { heightPx = 22 }: { heightPx?: number } = $props()
</script>

<div
    class="w-full shrink-0"
    style="
        height: {heightPx}px;
        background-image: url({vineDivider});
        background-repeat: repeat-x;
        background-position: center;
        background-size: auto 100%;
    "
    aria-hidden="true"
></div>
