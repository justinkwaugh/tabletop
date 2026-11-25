# Cover art

`render-18xx-covers.mjs` renders the catalogue covers of twelve 18xx titles,
`games/<title>-ui/src/lib/images/cover.webp`: a painting, print, map or engraving from Wikimedia
Commons or the title's public rulebook, under new title lettering. Each cover names the title's
designers and the artwork.

```sh
cd apps/frontend && node ../../tools/cover-art/render-18xx-covers.mjs [title ...]
```

It downloads the art and fonts (cached in the system temp directory), so it needs network access,
Playwright's Chromium, ImageMagick with WebP and poppler's `pdfimages`. A cover's window into its
source, lettering and colours are in the script's `covers` table.

| Title        | Artwork                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1817         | Joseph Pennell, _The Stock Exchange_, etching, 1904 (National Gallery of Art, CC0)                                                                            |
| 1822         | J. M. W. Turner, _Rain, Steam and Speed – The Great Western Railway_, 1844 (National Gallery, London)                                                         |
| 1833NE       | O. H. Bailey & J. C. Hazen, _City of Fall River, Mass._, 1877, the Fall River Line wharf, with the printed “Mount Hope Bay” painted out (Library of Congress) |
| 1846         | a letterpress-style poster around a vignette after Currier & Ives, _Lightning Express Trains_, 1874 (Library of Congress)                                     |
| 1849         | Thomas Cole, _Mount Etna from Taormina_                                                                                                                       |
| 1860         | Detroit Publishing Co. photochrom, _Ventnor from the East Cliff_, 1890s (Library of Congress)                                                                 |
| 1862         | the rulebook's coloured engraving of an early station, after the _Illustrated London News_, 1845 (GMT Games rulebook)                                         |
| 1882         | American Bank Note Co., _The Prairie Section of the Canadian Pacific Railway_, 1880s (BnF)                                                                    |
| 1894         | the rulebook's engraving of the Montparnasse derailment, 22 October 1895 (Jan Kłos's public rulebook)                                                         |
| 18Chesapeake | George Inness, _The Lackawanna Valley_, c. 1856 (National Gallery of Art, Washington)                                                                         |
| 18MEX        | José María Velasco, _Cañada de Metlac_, 1893 (Museo Nacional de Arte, Mexico City)                                                                            |
| 18USA        | after Frances F. Palmer, _Across the Continent_, Currier & Ives, 1868 (National Gallery of Art, CC0)                                                          |

The paintings, prints and map are public domain, and the engravings are as the rulebooks print them;
the script names each source. The fonts are Bodoni Moda, Cinzel, Playfair Display, IM Fell English,
IM Fell French Canon, Libre Caslon Text, Oswald, Abril Fatface, Alfa Slab One, Rye and Cormorant
Garamond, all under the SIL Open Font License and taken from
[google/fonts](https://github.com/google/fonts) at a pinned commit. They are only drawn into the
images; none is shipped.
