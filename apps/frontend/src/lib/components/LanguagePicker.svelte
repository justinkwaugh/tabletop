<script lang="ts">
    import { Label, Select } from 'flowbite-svelte'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { deviceLocale, localeOptions, switchDeviceLocale } from '$lib/i18n/locale'
    import { toLocale } from '$lib/paraglide/runtime'
    import { m } from '$lib/paraglide/messages'

    const BROWSER_DEFAULT = ''
    const { authorizationService, userPreferencesEditor: editor } = getAppContext()

    const options = localeOptions({ includePseudoLocale: import.meta.env.DEV })
    const chosen = $derived(
        toLocale(authorizationService.getSessionUser()?.preferences?.locale) ??
            deviceLocale() ??
            BROWSER_DEFAULT
    )
    let saving = $state(false)

    async function choose(select: HTMLSelectElement) {
        const locale = toLocale(select.value)
        saving = true
        const saved = await editor.updateNow({ locale })
        saving = false
        if (saved) {
            switchDeviceLocale(locale)
        } else {
            select.value = chosen
        }
    }
</script>

<div class="flex flex-col gap-2">
    <Label for="language">{m.preferences_language()}</Label>
    <Select
        id="language"
        class="w-auto self-start"
        classes={{ select: 'pe-9' }}
        size="sm"
        placeholder=""
        value={chosen}
        disabled={saving}
        onchange={(event) => void choose(event.currentTarget)}
    >
        <option value={BROWSER_DEFAULT}>{m.language_browser_default()}</option>
        {#each options as option (option.locale)}
            <option value={option.locale}>{option.name}</option>
        {/each}
    </Select>
</div>
