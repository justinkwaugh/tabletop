// Its own module, with no imports: the site loads the title's config, which names the boards,
// on every page, and must not build the boards' geometry to do it.
export enum BoardShape {
    Matrx = 'Matrx',
    Gipf = 'Gipf'
}
