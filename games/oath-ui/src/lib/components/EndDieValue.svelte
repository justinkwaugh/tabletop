<script lang="ts">
    import { endDieImage } from '$lib/images/diceImages.js'

    // R-3.3 — a rolled end die: its face, then its number.
    let { value }: { value: number } = $props()
</script>

<span class="inline-flex items-center gap-1 whitespace-nowrap" data-end-die={value}
    ><img
        class="inline-block h-[1.1em] w-auto rounded-[2px]"
        src={endDieImage(value)}
        alt=""
    />{value}</span
>
