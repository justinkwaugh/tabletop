<script lang="ts">
    const sections = [
        { id: 'tournaments', label: 'Tournaments', href: '/tournaments' },
        { id: 'leagues', label: 'Leagues', href: '/leagues' }
    ] as const

    let { current }: { current: (typeof sections)[number]['id'] } = $props()
</script>

<nav aria-label="Competitions" class="flex items-baseline gap-3.5 sm:gap-6">
    {#each sections as section, index (section.id)}
        {#if index > 0}
            <span
                aria-hidden="true"
                class="h-7 w-px self-center bg-gray-300 sm:h-8 dark:bg-gray-600"
            ></span>
        {/if}
        {#if section.id === current}
            <h1 class="competition-option collection-heading">{section.label}</h1>
        {:else}
            <a
                href={section.href}
                class="competition-option collection-heading text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
                >{section.label}</a
            >
        {/if}
    {/each}
</nav>

<style>
    @media (width < 640px) {
        .competition-option {
            font-size: 26px;
        }
    }
</style>
