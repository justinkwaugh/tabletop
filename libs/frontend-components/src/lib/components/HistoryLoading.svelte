<script lang="ts">
    import { onMount } from 'svelte'

    let { color }: { color: string } = $props()
    let visible = $state(false)

    onMount(() => {
        const timer = setTimeout(() => (visible = true), 300)
        return () => clearTimeout(timer)
    })
</script>

<div role="status" class="h-full flex items-center justify-center gap-2 text-sm {color}">
    {#if visible}
        <span>Loading history...</span>
        <svg class="spinner size-4" aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.25"
            ></circle>
            <path
                d="M12 3a9 9 0 0 1 9 9"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
            ></path>
        </svg>
    {/if}
</div>

<style>
    .spinner {
        animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .spinner {
            animation: none;
        }
    }
</style>
