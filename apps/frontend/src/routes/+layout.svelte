<script lang="ts">
    import RunOnceMounted from '$lib/components/RunOnceMounted.svelte'
    import { setAppContext } from '@tabletop/frontend-components'
    import { Toaster } from 'svelte-sonner'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import TimeAgo from 'javascript-time-ago'
    import en from 'javascript-time-ago/locale/en'
    TimeAgo.addDefaultLocale(en)

    let { children } = $props()
    setAppContext(getAppContext())
</script>

<Toaster position={'top-center'} richColors closeButton />
{@render children()}
<RunOnceMounted />
