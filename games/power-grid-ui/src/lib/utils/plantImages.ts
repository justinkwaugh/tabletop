import plant03 from '$lib/images/plants/plant-03.webp'
import plant04 from '$lib/images/plants/plant-04.webp'
import plant05 from '$lib/images/plants/plant-05.webp'
import plant06 from '$lib/images/plants/plant-06.webp'
import plant07 from '$lib/images/plants/plant-07.webp'
import plant08 from '$lib/images/plants/plant-08.webp'
import plant09 from '$lib/images/plants/plant-09.webp'
import plant10 from '$lib/images/plants/plant-10.webp'
import plant11 from '$lib/images/plants/plant-11.webp'
import plant12 from '$lib/images/plants/plant-12.webp'
import plant13 from '$lib/images/plants/plant-13.webp'
import plant14 from '$lib/images/plants/plant-14.webp'
import plant15 from '$lib/images/plants/plant-15.webp'
import plant16 from '$lib/images/plants/plant-16.webp'
import plant17 from '$lib/images/plants/plant-17.webp'
import plant18 from '$lib/images/plants/plant-18.webp'
import plant19 from '$lib/images/plants/plant-19.webp'
import plant20 from '$lib/images/plants/plant-20.webp'
import plant21 from '$lib/images/plants/plant-21.webp'
import plant22 from '$lib/images/plants/plant-22.webp'
import plant23 from '$lib/images/plants/plant-23.webp'
import plant24 from '$lib/images/plants/plant-24.webp'
import plant25 from '$lib/images/plants/plant-25.webp'
import plant26 from '$lib/images/plants/plant-26.webp'
import plant27 from '$lib/images/plants/plant-27.webp'
import plant28 from '$lib/images/plants/plant-28.webp'
import plant29 from '$lib/images/plants/plant-29.webp'
import plant30 from '$lib/images/plants/plant-30.webp'
import plant31 from '$lib/images/plants/plant-31.webp'
import plant32 from '$lib/images/plants/plant-32.webp'
import plant33 from '$lib/images/plants/plant-33.webp'
import plant34 from '$lib/images/plants/plant-34.webp'
import plant35 from '$lib/images/plants/plant-35.webp'
import plant36 from '$lib/images/plants/plant-36.webp'
import plant37 from '$lib/images/plants/plant-37.webp'
import plant38 from '$lib/images/plants/plant-38.webp'
import plant39 from '$lib/images/plants/plant-39.webp'
import plant40 from '$lib/images/plants/plant-40.webp'
import plant42 from '$lib/images/plants/plant-42.webp'
import plant44 from '$lib/images/plants/plant-44.webp'
import plant46 from '$lib/images/plants/plant-46.webp'
import plant50 from '$lib/images/plants/plant-50.webp'
import step3Card from '$lib/images/plants/step-3.webp'
import socketBack from '$lib/images/plants/socket-back.webp'

const PLANT_IMAGES: Record<number, string> = {
    3: plant03,
    4: plant04,
    5: plant05,
    6: plant06,
    7: plant07,
    8: plant08,
    9: plant09,
    10: plant10,
    11: plant11,
    12: plant12,
    13: plant13,
    14: plant14,
    15: plant15,
    16: plant16,
    17: plant17,
    18: plant18,
    19: plant19,
    20: plant20,
    21: plant21,
    22: plant22,
    23: plant23,
    24: plant24,
    25: plant25,
    26: plant26,
    27: plant27,
    28: plant28,
    29: plant29,
    30: plant30,
    31: plant31,
    32: plant32,
    33: plant33,
    34: plant34,
    35: plant35,
    36: plant36,
    37: plant37,
    38: plant38,
    39: plant39,
    40: plant40,
    42: plant42,
    44: plant44,
    46: plant46,
    50: plant50
}

export const STEP_3_IMAGE = step3Card
export const SOCKET_BACK_IMAGE = socketBack

export function plantImage(plant: number): string {
    return PLANT_IMAGES[plant]
}
