<script lang="ts">
    let { text }: { text: string } = $props()

    const parts = $derived(text.split(/(enhanced)/))
</script>

{#each parts as part, index (index)}{#if part === 'enhanced'}<span class="enhanced">{part}</span
        >{:else}{part}{/if}{/each}

<style>
    .enhanced {
        font-weight: 700;
        color: var(--mg-enhanced);
    }
</style>
