<script lang="ts">
    import type { SizedImage } from '$lib/images/manifestIndex.js'

    let {
        count,
        image,
        cost = false,
        orMore = false
    }: { count: number; image: SizedImage; cost?: boolean; orMore?: boolean } = $props()
</script>

<span class="inline-flex items-center gap-1 whitespace-nowrap {cost ? 'text-oath-accent' : ''}">
    <span class={count === 0 ? 'text-oath-text-muted' : ''}>{count}{orMore ? '+' : ''}</span>
    <img class="h-[18px] w-auto" src={image.src} width={image.width} height={image.height} alt="" />
</span>
