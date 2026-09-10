<script lang="ts">
    import { setLibraryView } from '$lib/stores/libraryView'

    let { children } = $props()
    const view = $state({ scrollTop: 0 })
    setLibraryView(view)
</script>

{@render children()}
