<script lang="ts">
    let { count, image }: { count: number; image: string } = $props()
</script>

<span class="inline-flex items-center gap-1 whitespace-nowrap">
    <span class={count === 0 ? 'text-oath-text-muted' : ''}>{count}</span>
    <img class="h-[18px] w-auto" src={image} alt="" />
</span>
