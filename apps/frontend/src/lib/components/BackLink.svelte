<script lang="ts">
    import { ArrowLeftOutline } from 'flowbite-svelte-icons'

    let { href, label }: { href: string; label: string } = $props()
</script>

<a class="back-link" {href}><ArrowLeftOutline class="h-4 w-4" /> {label}</a>

<style>
    .back-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--color-gray-400);
        font-size: 14px;
    }
    .back-link:hover {
        color: var(--color-blue-300);
    }
    .back-link:focus-visible {
        outline: 2px solid var(--color-blue-300);
        outline-offset: 4px;
    }
</style>
