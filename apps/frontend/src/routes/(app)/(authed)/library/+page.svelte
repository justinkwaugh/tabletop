<script lang="ts">
    import LandingPage from '$lib/components/LandingPage.svelte'
    import { getLibraryView, type LibraryView } from '$lib/stores/libraryView'
    import { m } from '$lib/paraglide/messages'
    const view = getLibraryView()
    export const snapshot = {
        capture: () => ({ ...view }),
        restore: (value: LibraryView) => {
            view.scrollTop = value.scrollTop
        }
    }
</script>

<svelte:head><title>{m.library_page_title()}</title></svelte:head>

<LandingPage signedIn bind:scrollTop={view.scrollTop} />
