<script lang="ts">
    import LandingPage from '$lib/components/LandingPage.svelte'
    import { getLibraryView, type LibraryView } from '$lib/stores/libraryView'
    const view = getLibraryView()
    export const snapshot = {
        capture: () => ({ ...view }),
        restore: (value: LibraryView) => {
            view.scrollTop = value.scrollTop
        }
    }
</script>

<svelte:head><title>Game library — Board Together</title></svelte:head>

<LandingPage signedIn bind:scrollTop={view.scrollTop} />
