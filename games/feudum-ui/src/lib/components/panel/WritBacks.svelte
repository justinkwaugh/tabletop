<script lang="ts">
    import WritFace from '$lib/components/pieces/WritFace.svelte'

    /** R-4.4.1 The drawn count as backs: no seat but the drawer sees which. */
    let { count }: { count: number } = $props()

    const BackWidth = 48
</script>

<div class="flex w-full flex-wrap gap-1" data-writ-backs={count}>
    {#each { length: count }, index (index)}
        <WritFace faceShown={false} width={BackWidth} />
    {/each}
</div>
