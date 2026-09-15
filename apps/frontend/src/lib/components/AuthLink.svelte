<script lang="ts">
    import type { Snippet } from 'svelte'

    let {
        href,
        onactivate,
        children
    }: { href: string; onactivate?: () => void; children: Snippet } = $props()

    function follow(event: MouseEvent) {
        if (onactivate && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
            event.preventDefault()
            onactivate()
        }
    }
</script>

<a {href} onclick={follow} class="font-medium hover:underline dark:text-orange-300">
    {@render children()}
</a>
