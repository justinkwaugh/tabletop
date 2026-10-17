<script lang="ts">
    import { Helper, Toggle } from 'flowbite-svelte'
    import { flip } from 'svelte/animate'
    import type { Color } from '@tabletop/common'
    import { ColorblindColorizer, DefaultColorizer } from '@tabletop/frontend-components'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    const { userPreferencesEditor: editor } = getAppContext()
    const preferences = $derived(editor.values)

    const colorblindColorizer = new ColorblindColorizer()
    const defaultColorizer = new DefaultColorizer()

    function bgColorForColor(color: Color) {
        return preferences.colorBlindPalette
            ? colorblindColorizer.getBgColor(color)
            : defaultColorizer.getBgColor(color)
    }

    let draggedColor: Color | undefined = $state(undefined)
    let draggedIndex: number | undefined = $state(undefined)

    function dragStart(index: number, color: Color) {
        draggedColor = color
        draggedIndex = index
    }

    function dragEnter(index: number) {
        if (draggedIndex === undefined || !draggedColor) return
        if (preferences.preferredColors[index] === draggedColor) return

        const preferredColors = preferences.preferredColors.filter(
            (color) => color !== draggedColor
        )
        preferredColors.splice(index, 0, draggedColor)
        editor.update({ preferredColors })
        draggedIndex = index
    }

    function dragEnd() {
        draggedIndex = undefined
        draggedColor = undefined
    }
</script>

<svelte:head>
    <script
        src="https://drag-drop-touch-js.github.io/dragdroptouch/dist/drag-drop-touch.esm.min.js?autoload"
        type="module"
    ></script>
</svelte:head>

<div class="flex flex-col space-y-6">
    <Toggle
        checked={preferences.preventWebNotificationPrompt}
        onchange={(event) =>
            editor.update({ preventWebNotificationPrompt: event.currentTarget.checked })}
        >Prevent Web Notifications Prompt</Toggle
    >
    <Toggle
        checked={preferences.colorBlindPalette ?? false}
        onchange={(event) => editor.update({ colorBlindPalette: event.currentTarget.checked })}
        >Colorblind Friendly Palette</Toggle
    >
    <div>
        <Toggle
            checked={preferences.preferredColorsEnabled}
            onchange={(event) =>
                editor.update({ preferredColorsEnabled: event.currentTarget.checked })}
            >Preferred Player Colors</Toggle
        >

        {#if preferences.preferredColorsEnabled}
            <div class="mt-4 flex flex-col rounded-lg border-gray-600 border p-2">
                <div class="flex flex-row justify-center items-center gap-1">
                    {#each preferences.preferredColors as color, i (color)}
                        <div
                            role="button"
                            tabindex="0"
                            draggable="true"
                            ondragover={(event) => event.preventDefault()}
                            ondrop={(event) => event.preventDefault()}
                            ondragstart={() => dragStart(i, color)}
                            ondragenter={() => dragEnter(i)}
                            ondragend={dragEnd}
                            animate:flip={{ duration: 100 }}
                            class="rounded-lg h-[40px] w-[26px] {bgColorForColor(
                                color
                            )} border-gray-800 border-2"
                        ></div>
                    {/each}
                </div>
                <div class="flex flex-row justify-center items-center">
                    <Helper class="mt-2" color="gray"
                        ><span class="font-medium">drag to reorder</span></Helper
                    >
                </div>
            </div>
        {/if}
    </div>
</div>
