export const scrollToRight = (node: HTMLDivElement) => {
    requestAnimationFrame(() => {
        node.scrollTo({ left: node.scrollWidth, behavior: 'instant' })
    })
}
