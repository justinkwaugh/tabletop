<script lang="ts">
    import type { SizedImage } from '$lib/images/manifestIndex.js'

    let { count, image }: { count: number; image: SizedImage } = $props()
</script>

<span class="inline-flex items-center gap-1 whitespace-nowrap">
    <span class={count === 0 ? 'text-oath-text-muted' : ''}>{count}</span>
    <img class="h-[18px] w-auto" src={image.src} width={image.width} height={image.height} alt="" />
</span>
