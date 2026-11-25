<script lang="ts">
    import { Helper, Toggle } from 'flowbite-svelte'
    import type { Color } from '@tabletop/common'
    import { ColorblindColorizer, DefaultColorizer } from '@tabletop/frontend-components'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import PreferredColorOrder from '$lib/components/PreferredColorOrder.svelte'
    import LanguagePicker from '$lib/components/LanguagePicker.svelte'
    import { m } from '$lib/paraglide/messages'

    const { userPreferencesEditor: editor } = getAppContext()
    const preferences = $derived(editor.values)

    const colorblindColorizer = new ColorblindColorizer()
    const defaultColorizer = new DefaultColorizer()

    function bgColorForColor(color: Color) {
        return preferences.colorBlindPalette
            ? colorblindColorizer.getBgColor(color)
            : defaultColorizer.getBgColor(color)
    }
</script>

<div class="flex flex-col space-y-6 outline-none" tabindex="-1" data-autofocus>
    <LanguagePicker />
    <Toggle
        checked={preferences.preventWebNotificationPrompt}
        onchange={(event) =>
            editor.update({ preventWebNotificationPrompt: event.currentTarget.checked })}
        >{m.preferences_prevent_web_notification_prompt()}</Toggle
    >
    <Toggle
        checked={preferences.colorBlindPalette ?? false}
        onchange={(event) => editor.update({ colorBlindPalette: event.currentTarget.checked })}
        >{m.preferences_colorblind_palette()}</Toggle
    >
    <div>
        <Toggle
            checked={preferences.preferredColorsEnabled}
            onchange={(event) =>
                editor.update({ preferredColorsEnabled: event.currentTarget.checked })}
            >{m.preferences_preferred_player_colors()}</Toggle
        >

        {#if preferences.preferredColorsEnabled}
            <div class="mt-4 flex flex-col rounded-lg border-gray-600 border p-2">
                <PreferredColorOrder
                    colors={preferences.preferredColors}
                    swatchClass={bgColorForColor}
                    onchange={(preferredColors) => editor.update({ preferredColors })}
                />
            </div>
        {/if}
    </div>
    <div>
        <Toggle
            checked={preferences.bgStatsEnabled ?? false}
            onchange={(event) => editor.update({ bgStatsEnabled: event.currentTarget.checked })}
            >{m.preferences_bg_stats()}</Toggle
        >
        <Helper class="mt-2" color="gray">
            {m.preferences_bg_stats_help()}
        </Helper>
    </div>
</div>
