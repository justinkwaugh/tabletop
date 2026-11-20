/** Its own glob, so the UI entry the site loads to list its library carries no asset map. */
const files = import.meta.glob<string>('./supplied/cover.{webp,png}', {
    eager: true,
    import: 'default'
})

export const suppliedCover: string | undefined =
    files['./supplied/cover.webp'] ?? files['./supplied/cover.png']
