<script lang="ts">
    import { ArrowRightOutline } from 'flowbite-svelte-icons'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    let { label }: { label: string } = $props()
    const { authorizationService } = getAppContext()
    const libraryUrl = $derived(authorizationService.getSessionUser() ? '/library' : '/#games')
</script>

<a class="library-link" href={libraryUrl}>
    {label}
    <ArrowRightOutline class="h-4 w-4" />
</a>

<style>
    .library-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--color-blue-300);
        font-size: 14px;
    }
    .library-link:hover {
        text-decoration: underline;
        text-underline-offset: 4px;
    }
    .library-link:focus-visible {
        outline: 2px solid var(--color-blue-400);
        outline-offset: 5px;
        border-radius: 3px;
    }
</style>
