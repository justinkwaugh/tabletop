<script lang="ts">
    import { Helper, Toggle } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import { flip } from 'svelte/animate'
    import { assertExists, type Color } from '@tabletop/common'
    import {
        ColorblindColorizer,
        DefaultColorizer,
        getAppContext
    } from '@tabletop/frontend-components'
    import { UserPreferencesEditor } from '$lib/services/userPreferencesEditor.svelte'

    const { authorizationService, api } = getAppContext()
    const user = authorizationService.getSessionUser()
    assertExists(user, 'Preferences require a signed-in user')

    const editor = new UserPreferencesEditor(
        user,
        api,
        (savedUser) => authorizationService.setSessionUser(savedUser),
        () => toast.error('Could not save your preferences. Please try again.')
    )
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
    let startIndex: number | undefined

    function dragStart(index: number, color: Color) {
        draggedColor = color
        draggedIndex = index
        startIndex = index
    }

    function dragEnter(index: number) {
        if (draggedIndex === undefined || !draggedColor) return
        if (preferences.preferredColors[index] === draggedColor) return

        preferences.preferredColors.splice(draggedIndex, 1)
        preferences.preferredColors.splice(index, 0, draggedColor)
        draggedIndex = index
    }

    function dragEnd() {
        const moved = draggedIndex !== startIndex
        draggedIndex = undefined
        draggedColor = undefined
        startIndex = undefined
        if (moved) editor.save()
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
                <div class="flex flex-row justify-between items-center">
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
