import {
    SettlementKind,
    type ExternalConnectionDefinition,
    type LinkDefinition,
    type SettlementDefinition
} from '../types.js'

export const SETTLEMENTS: readonly SettlementDefinition[] = [
    {
        id: 'railhead-1',
        name: 'Railhead 1',
        kind: SettlementKind.AgriculturalRailhead,
        x: 460,
        y: 207
    },
    { id: 'brown-base', name: 'Brown Base', kind: SettlementKind.RailroadBase, x: 737.5, y: 205.5 },
    { id: 'station-1', name: 'Station 1', kind: SettlementKind.RailroadStation, x: 541, y: 210.5 },
    { id: 'station-2', name: 'Station 2', kind: SettlementKind.RailroadStation, x: 645.5, y: 205 },
    { id: 'green-base', name: 'Green Base', kind: SettlementKind.RailroadBase, x: 1352, y: 212 },
    { id: 'black-base', name: 'Black Base', kind: SettlementKind.RailroadBase, x: 106, y: 259.5 },
    { id: 'station-3', name: 'Station 3', kind: SettlementKind.RailroadStation, x: 1462, y: 284 },
    {
        id: 'railhead-2',
        name: 'Railhead 2',
        kind: SettlementKind.AgriculturalRailhead,
        x: 545,
        y: 267
    },
    { id: 'station-4', name: 'Station 4', kind: SettlementKind.RailroadStation, x: 624, y: 283.5 },
    {
        id: 'railhead-3',
        name: 'Railhead 3',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1127,
        y: 279
    },
    {
        id: 'railhead-4',
        name: 'Railhead 4',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1050,
        y: 288.5
    },
    { id: 'station-5', name: 'Station 5', kind: SettlementKind.RailroadStation, x: 779, y: 291.5 },
    { id: 'red-base', name: 'Red Base', kind: SettlementKind.RailroadBase, x: 1513, y: 369 },
    { id: 'station-6', name: 'Station 6', kind: SettlementKind.RailroadStation, x: 1113, y: 359.5 },
    { id: 'station-7', name: 'Station 7', kind: SettlementKind.RailroadStation, x: 1428, y: 384 },
    {
        id: 'station-8',
        name: 'Station 8',
        kind: SettlementKind.RailroadStation,
        x: 580.5,
        y: 360.5
    },
    {
        id: 'railhead-5',
        name: 'Railhead 5',
        kind: SettlementKind.AgriculturalRailhead,
        x: 749.5,
        y: 369
    },
    { id: 'station-9', name: 'Station 9', kind: SettlementKind.RailroadStation, x: 113, y: 393.5 },
    { id: 'station-10', name: 'Station 10', kind: SettlementKind.RailroadStation, x: 895, y: 368 },
    {
        id: 'station-11',
        name: 'Station 11',
        kind: SettlementKind.RailroadStation,
        x: 1215.5,
        y: 399.5
    },
    {
        id: 'railhead-6',
        name: 'Railhead 6',
        kind: SettlementKind.AgriculturalRailhead,
        x: 672.5,
        y: 391.5
    },
    {
        id: 'railhead-7',
        name: 'Railhead 7',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1063,
        y: 393.5
    },
    {
        id: 'railhead-8',
        name: 'Railhead 8',
        kind: SettlementKind.AgriculturalRailhead,
        x: 350,
        y: 402
    },
    {
        id: 'railhead-9',
        name: 'Railhead 9',
        kind: SettlementKind.AgriculturalRailhead,
        x: 267.5,
        y: 419.5
    },
    {
        id: 'station-12',
        name: 'Station 12',
        kind: SettlementKind.RailroadStation,
        x: 186,
        y: 423.5
    },
    {
        id: 'station-13',
        name: 'Station 13',
        kind: SettlementKind.RailroadStation,
        x: 435,
        y: 401.5
    },
    {
        id: 'station-14',
        name: 'Station 14',
        kind: SettlementKind.RailroadStation,
        x: 946.5,
        y: 435.5
    },
    {
        id: 'railhead-10',
        name: 'Railhead 10',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1098,
        y: 440
    },
    {
        id: 'station-15',
        name: 'Station 15',
        kind: SettlementKind.RailroadStation,
        x: 588.5,
        y: 447
    },
    {
        id: 'station-16',
        name: 'Station 16',
        kind: SettlementKind.RailroadStation,
        x: 233.5,
        y: 489
    },
    {
        id: 'station-17',
        name: 'Station 17',
        kind: SettlementKind.RailroadStation,
        x: 402.5,
        y: 477.5
    },
    { id: 'junction', name: 'The Junction', kind: SettlementKind.MetroArea, x: 1272.5, y: 492.5 },
    {
        id: 'railhead-11',
        name: 'Railhead 11',
        kind: SettlementKind.AgriculturalRailhead,
        x: 154,
        y: 506.5
    },
    {
        id: 'station-18',
        name: 'Station 18',
        kind: SettlementKind.RailroadStation,
        x: 486.5,
        y: 495
    },
    { id: 'station-19', name: 'Station 19', kind: SettlementKind.RailroadStation, x: 1134, y: 521 },
    {
        id: 'station-20',
        name: 'Station 20',
        kind: SettlementKind.RailroadStation,
        x: 317.5,
        y: 530
    },
    {
        id: 'railhead-12',
        name: 'Railhead 12',
        kind: SettlementKind.AgriculturalRailhead,
        x: 178,
        y: 566
    },
    {
        id: 'railhead-13',
        name: 'Railhead 13',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1419,
        y: 579
    },
    {
        id: 'station-21',
        name: 'Station 21',
        kind: SettlementKind.RailroadStation,
        x: 383,
        y: 575.5
    },
    { id: 'station-22', name: 'Station 22', kind: SettlementKind.RailroadStation, x: 636, y: 564 },
    {
        id: 'market-1',
        name: 'Mercantile Center 1',
        kind: SettlementKind.MercantileCenter,
        x: 978,
        y: 580
    },
    {
        id: 'station-23',
        name: 'Station 23',
        kind: SettlementKind.RailroadStation,
        x: 887,
        y: 588.5
    },
    {
        id: 'station-24',
        name: 'Station 24',
        kind: SettlementKind.RailroadStation,
        x: 453.5,
        y: 617
    },
    {
        id: 'railhead-14',
        name: 'Railhead 14',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1192.5,
        y: 616.5
    },
    {
        id: 'market-2',
        name: 'Mercantile Center 2',
        kind: SettlementKind.MercantileCenter,
        x: 781,
        y: 638.5
    },
    {
        id: 'railhead-15',
        name: 'Railhead 15',
        kind: SettlementKind.AgriculturalRailhead,
        x: 214,
        y: 665
    },
    {
        id: 'railhead-16',
        name: 'Railhead 16',
        kind: SettlementKind.AgriculturalRailhead,
        x: 888,
        y: 679.5
    },
    {
        id: 'station-25',
        name: 'Station 25',
        kind: SettlementKind.RailroadStation,
        x: 984.5,
        y: 677.5
    },
    { id: 'blue-base', name: 'Blue Base', kind: SettlementKind.RailroadBase, x: 1390.5, y: 703.5 },
    { id: 'center', name: 'The Center', kind: SettlementKind.MetroArea, x: 665, y: 726 },
    {
        id: 'station-26',
        name: 'Station 26',
        kind: SettlementKind.RailroadStation,
        x: 885.5,
        y: 757
    },
    {
        id: 'railhead-17',
        name: 'Railhead 17',
        kind: SettlementKind.AgriculturalRailhead,
        x: 334,
        y: 761
    },
    { id: 'station-27', name: 'Station 27', kind: SettlementKind.RailroadStation, x: 977, y: 778 },
    {
        id: 'market-3',
        name: 'Mercantile Center 3',
        kind: SettlementKind.MercantileCenter,
        x: 563.5,
        y: 787
    },
    {
        id: 'station-28',
        name: 'Station 28',
        kind: SettlementKind.RailroadStation,
        x: 1103.5,
        y: 776.5
    },
    {
        id: 'station-29',
        name: 'Station 29',
        kind: SettlementKind.RailroadStation,
        x: 790.5,
        y: 788.5
    },
    { id: 'station-30', name: 'Station 30', kind: SettlementKind.RailroadStation, x: 1299, y: 781 },
    {
        id: 'railhead-18',
        name: 'Railhead 18',
        kind: SettlementKind.AgriculturalRailhead,
        x: 264.5,
        y: 799
    },
    { id: 'station-31', name: 'Station 31', kind: SettlementKind.RailroadStation, x: 716, y: 834 },
    {
        id: 'station-32',
        name: 'Station 32',
        kind: SettlementKind.RailroadStation,
        x: 490.5,
        y: 833.5
    },
    {
        id: 'station-33',
        name: 'Station 33',
        kind: SettlementKind.RailroadStation,
        x: 130.5,
        y: 843.5
    },
    {
        id: 'market-4',
        name: 'Mercantile Center 4',
        kind: SettlementKind.MercantileCenter,
        x: 215,
        y: 851.5
    },
    {
        id: 'station-34',
        name: 'Station 34',
        kind: SettlementKind.RailroadStation,
        x: 339,
        y: 878.5
    },
    {
        id: 'station-35',
        name: 'Station 35',
        kind: SettlementKind.RailroadStation,
        x: 423,
        y: 883.5
    },
    {
        id: 'station-36',
        name: 'Station 36',
        kind: SettlementKind.RailroadStation,
        x: 908,
        y: 877.5
    },
    {
        id: 'station-37',
        name: 'Station 37',
        kind: SettlementKind.RailroadStation,
        x: 998,
        y: 890.5
    },
    {
        id: 'railhead-19',
        name: 'Railhead 19',
        kind: SettlementKind.AgriculturalRailhead,
        x: 660,
        y: 906.5
    },
    { id: 'station-38', name: 'Station 38', kind: SettlementKind.RailroadStation, x: 1253, y: 900 },
    {
        id: 'railhead-20',
        name: 'Railhead 20',
        kind: SettlementKind.AgriculturalRailhead,
        x: 914,
        y: 957.5
    },
    {
        id: 'railhead-21',
        name: 'Railhead 21',
        kind: SettlementKind.AgriculturalRailhead,
        x: 427.5,
        y: 966
    },
    { id: 'station-39', name: 'Station 39', kind: SettlementKind.RailroadStation, x: 934, y: 1008 }
]

export const LINKS: readonly LinkDefinition[] = [
    { id: 'black-base~station-9', ends: ['black-base', 'station-9'], box: { x: 107, y: 331.5 } },
    { id: 'blue-base~junction', ends: ['blue-base', 'junction'], box: { x: 1351.5, y: 579 } },
    { id: 'blue-base~station-30', ends: ['blue-base', 'station-30'], box: { x: 1348.5, y: 733.5 } },
    { id: 'brown-base~station-2', ends: ['brown-base', 'station-2'], box: { x: 691, y: 208.5 } },
    { id: 'brown-base~station-5', ends: ['brown-base', 'station-5'], box: { x: 759, y: 246 } },
    { id: 'center~market-2', ends: ['center', 'market-2'], box: { x: 745, y: 674 } },
    { id: 'center~market-3', ends: ['center', 'market-3'], box: { x: 591.5, y: 755 } },
    { id: 'center~station-18', ends: ['center', 'station-18'], box: { x: 589, y: 618.5 } },
    { id: 'center~station-22', ends: ['center', 'station-22'], box: { x: 657.5, y: 638.5 } },
    { id: 'center~station-24', ends: ['center', 'station-24'], box: { x: 527.5, y: 649 } },
    { id: 'center~station-26', ends: ['center', 'station-26'], box: { x: 792, y: 742.5 } },
    { id: 'center~station-29', ends: ['center', 'station-29'], box: { x: 750, y: 771.5 } },
    { id: 'center~station-31', ends: ['center', 'station-31'], box: { x: 698.5, y: 795.5 } },
    { id: 'green-base~station-11', ends: ['green-base', 'station-11'], box: { x: 1246.5, y: 300 } },
    { id: 'green-base~station-3', ends: ['green-base', 'station-3'], box: { x: 1390, y: 237 } },
    { id: 'junction~station-11', ends: ['junction', 'station-11'], box: { x: 1242.5, y: 438 } },
    { id: 'junction~station-19', ends: ['junction', 'station-19'], box: { x: 1202.5, y: 500.5 } },
    { id: 'junction~station-7', ends: ['junction', 'station-7'], box: { x: 1366, y: 418 } },
    { id: 'market-1~station-14', ends: ['market-1', 'station-14'], box: { x: 968, y: 502.5 } },
    { id: 'market-1~station-19', ends: ['market-1', 'station-19'], box: { x: 1056, y: 549 } },
    { id: 'market-1~station-23', ends: ['market-1', 'station-23'], box: { x: 931.5, y: 583.5 } },
    { id: 'market-1~station-25', ends: ['market-1', 'station-25'], box: { x: 983.5, y: 634 } },
    { id: 'market-2~station-14', ends: ['market-2', 'station-14'], box: { x: 837, y: 483 } },
    { id: 'market-2~station-22', ends: ['market-2', 'station-22'], box: { x: 707, y: 609 } },
    { id: 'market-2~station-23', ends: ['market-2', 'station-23'], box: { x: 843, y: 609 } },
    { id: 'market-3~railhead-19', ends: ['market-3', 'railhead-19'], box: { x: 614.5, y: 844 } },
    { id: 'market-3~station-24', ends: ['market-3', 'station-24'], box: { x: 482, y: 684 } },
    { id: 'market-3~station-31', ends: ['market-3', 'station-31'], box: { x: 658, y: 809.5 } },
    { id: 'market-3~station-32', ends: ['market-3', 'station-32'], box: { x: 526.5, y: 811 } },
    { id: 'market-4~station-33', ends: ['market-4', 'station-33'], box: { x: 172, y: 851 } },
    { id: 'market-4~station-34', ends: ['market-4', 'station-34'], box: { x: 280, y: 865.5 } },
    { id: 'railhead-1~station-1', ends: ['railhead-1', 'station-1'], box: { x: 500, y: 211.5 } },
    {
        id: 'railhead-10~station-19',
        ends: ['railhead-10', 'station-19'],
        box: { x: 1116.5, y: 482 }
    },
    {
        id: 'railhead-11~station-16',
        ends: ['railhead-11', 'station-16'],
        box: { x: 193, y: 496.5 }
    },
    {
        id: 'railhead-12~station-16',
        ends: ['railhead-12', 'station-16'],
        box: { x: 207, y: 534.5 }
    },
    { id: 'railhead-13~station-7', ends: ['railhead-13', 'station-7'], box: { x: 1426, y: 482.5 } },
    {
        id: 'railhead-14~station-25',
        ends: ['railhead-14', 'station-25'],
        box: { x: 1088.5, y: 647 }
    },
    {
        id: 'railhead-15~station-21',
        ends: ['railhead-15', 'station-21'],
        box: { x: 296.5, y: 620 }
    },
    {
        id: 'railhead-16~station-23',
        ends: ['railhead-16', 'station-23'],
        box: { x: 886, y: 633.5 }
    },
    {
        id: 'railhead-17~station-32',
        ends: ['railhead-17', 'station-32'],
        box: { x: 399.5, y: 797.5 }
    },
    {
        id: 'railhead-18~station-34',
        ends: ['railhead-18', 'station-34'],
        box: { x: 302.5, y: 831 }
    },
    { id: 'railhead-2~station-4', ends: ['railhead-2', 'station-4'], box: { x: 585.5, y: 269.5 } },
    {
        id: 'railhead-20~station-36',
        ends: ['railhead-20', 'station-36'],
        box: { x: 907.5, y: 917 }
    },
    {
        id: 'railhead-21~station-35',
        ends: ['railhead-21', 'station-35'],
        box: { x: 428.5, y: 924 }
    },
    { id: 'railhead-3~station-6', ends: ['railhead-3', 'station-6'], box: { x: 1118.5, y: 318.5 } },
    { id: 'railhead-4~station-6', ends: ['railhead-4', 'station-6'], box: { x: 1077, y: 321.5 } },
    { id: 'railhead-5~station-5', ends: ['railhead-5', 'station-5'], box: { x: 765.5, y: 330 } },
    { id: 'railhead-6~station-15', ends: ['railhead-6', 'station-15'], box: { x: 634.5, y: 427 } },
    { id: 'railhead-7~station-14', ends: ['railhead-7', 'station-14'], box: { x: 1009, y: 418 } },
    { id: 'railhead-8~station-13', ends: ['railhead-8', 'station-13'], box: { x: 392, y: 402.5 } },
    { id: 'railhead-9~station-12', ends: ['railhead-9', 'station-12'], box: { x: 227, y: 422 } },
    { id: 'red-base~station-7', ends: ['red-base', 'station-7'], box: { x: 1467.5, y: 371 } },
    { id: 'station-1~station-13', ends: ['station-1', 'station-13'], box: { x: 424, y: 299 } },
    { id: 'station-1~station-2', ends: ['station-1', 'station-2'], box: { x: 583.5, y: 210.5 } },
    { id: 'station-10~station-14', ends: ['station-10', 'station-14'], box: { x: 919, y: 403 } },
    {
        id: 'station-10~station-22',
        ends: ['station-10', 'station-22'],
        box: { x: 785.5, y: 456.5 }
    },
    { id: 'station-10~station-5', ends: ['station-10', 'station-5'], box: { x: 839, y: 338.5 } },
    { id: 'station-10~station-6', ends: ['station-10', 'station-6'], box: { x: 991, y: 335 } },
    { id: 'station-11~station-6', ends: ['station-11', 'station-6'], box: { x: 1174, y: 375 } },
    {
        id: 'station-12~station-16',
        ends: ['station-12', 'station-16'],
        box: { x: 206.5, y: 457.5 }
    },
    { id: 'station-12~station-9', ends: ['station-12', 'station-9'], box: { x: 145, y: 420.5 } },
    {
        id: 'station-13~station-17',
        ends: ['station-13', 'station-17'],
        box: { x: 415.5, y: 437.5 }
    },
    { id: 'station-15~station-22', ends: ['station-15', 'station-22'], box: { x: 608, y: 501.5 } },
    { id: 'station-15~station-8', ends: ['station-15', 'station-8'], box: { x: 578.5, y: 405.5 } },
    { id: 'station-16~station-20', ends: ['station-16', 'station-20'], box: { x: 275.5, y: 503 } },
    {
        id: 'station-17~station-18',
        ends: ['station-17', 'station-18'],
        box: { x: 445.5, y: 486.5 }
    },
    {
        id: 'station-17~station-20',
        ends: ['station-17', 'station-20'],
        box: { x: 361.5, y: 505.5 }
    },
    { id: 'station-18~station-8', ends: ['station-18', 'station-8'], box: { x: 519.5, y: 329 } },
    { id: 'station-2~station-4', ends: ['station-2', 'station-4'], box: { x: 631.5, y: 243.5 } },
    { id: 'station-20~station-21', ends: ['station-20', 'station-21'], box: { x: 352, y: 550.5 } },
    { id: 'station-21~station-24', ends: ['station-21', 'station-24'], box: { x: 419, y: 593.5 } },
    { id: 'station-25~station-27', ends: ['station-25', 'station-27'], box: { x: 979, y: 734 } },
    {
        id: 'station-26~station-27',
        ends: ['station-26', 'station-27'],
        box: { x: 933.5, y: 768.5 }
    },
    { id: 'station-26~station-29', ends: ['station-26', 'station-29'], box: { x: 835, y: 775 } },
    { id: 'station-27~station-28', ends: ['station-27', 'station-28'], box: { x: 1043, y: 774 } },
    { id: 'station-28~station-30', ends: ['station-28', 'station-30'], box: { x: 1188, y: 779.5 } },
    { id: 'station-28~station-37', ends: ['station-28', 'station-37'], box: { x: 1059.5, y: 841 } },
    { id: 'station-29~station-36', ends: ['station-29', 'station-36'], box: { x: 861, y: 832.5 } },
    { id: 'station-3~station-7', ends: ['station-3', 'station-7'], box: { x: 1438, y: 330.5 } },
    { id: 'station-30~station-38', ends: ['station-30', 'station-38'], box: { x: 1275, y: 841 } },
    { id: 'station-31~station-39', ends: ['station-31', 'station-39'], box: { x: 768.5, y: 934 } },
    {
        id: 'station-32~station-35',
        ends: ['station-32', 'station-35'],
        box: { x: 458.5, y: 862.5 }
    },
    { id: 'station-33~station-9', ends: ['station-33', 'station-9'], box: { x: 74.5, y: 707.5 } },
    {
        id: 'station-34~station-35',
        ends: ['station-34', 'station-35'],
        box: { x: 380.5, y: 882.5 }
    },
    {
        id: 'station-36~station-37',
        ends: ['station-36', 'station-37'],
        box: { x: 951.5, y: 890.5 }
    },
    { id: 'station-37~station-38', ends: ['station-37', 'station-38'], box: { x: 1123, y: 900.5 } },
    {
        id: 'station-38~station-39',
        ends: ['station-38', 'station-39'],
        box: { x: 1182.5, y: 954.5 }
    },
    { id: 'station-4~station-8', ends: ['station-4', 'station-8'], box: { x: 596.5, y: 317 } }
]

export const EXTERNAL_CONNECTIONS: readonly ExternalConnectionDefinition[] = [
    {
        id: 'south-frontier',
        name: 'South Frontier',
        settlementId: 'station-39',
        price: 30,
        value: 40,
        x: 934,
        y: 1060
    },
    {
        id: 'west-frontier',
        name: 'West Frontier',
        settlementId: 'station-33',
        price: 40,
        value: 30,
        x: 128.5,
        y: 909.5
    }
]
