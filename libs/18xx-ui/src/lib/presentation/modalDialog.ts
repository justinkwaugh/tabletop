export function showModal(dialog: HTMLDialogElement) {
    dialog.showModal()
}

export function clickedBackdrop(dialog: HTMLDialogElement, event: MouseEvent): boolean {
    if (event.target !== dialog) return false
    const bounds = dialog.getBoundingClientRect()
    return (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
    )
}
