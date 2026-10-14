/** Offers a file the page made as a download, the way a browser saves any file it is given. */
export function saveToDevice(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
}
