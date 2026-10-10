<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements'

    let { previous = false, ...rest }: { previous?: boolean } & HTMLAttributes<HTMLSpanElement> = $props()
</script>

<!-- One shape wherever the overseer is tagged. The fixed line height keeps it no taller than a
     bidding row's name chip, so tagging a player never changes a row's height. -->
<span
    class="font-heading text-[13px] leading-[16px] bg-black/30 text-white px-1.5 py-[3px] rounded font-normal shrink-0 normal-case tracking-normal whitespace-nowrap"
    class:opacity-70={previous}
    {...rest}
>
    {previous ? 'Previous Overseer' : 'Overseer'}
</span>
