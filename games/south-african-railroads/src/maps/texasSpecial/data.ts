import { SettlementKind, type LinkDefinition, type SettlementDefinition } from '../types.js'

export const SETTLEMENTS: readonly SettlementDefinition[] = [
    {
        id: 'junction-city',
        name: 'Junction City',
        kind: SettlementKind.RailroadBase,
        x: 68,
        y: 480
    },
    { id: 'st-louis', name: 'St. Louis', kind: SettlementKind.RailroadBase, x: 849, y: 460 },
    { id: 'springfield', name: 'Springfield', kind: SettlementKind.RailroadBase, x: 611, y: 824 },
    { id: 'san-antonio', name: 'San Antonio', kind: SettlementKind.RailroadBase, x: 179, y: 1622 },
    { id: 'galveston', name: 'Galveston', kind: SettlementKind.RailroadBase, x: 710, y: 1683 },
    { id: 'kansas-city', name: 'Kansas City', kind: SettlementKind.MetroArea, x: 337, y: 377 },
    { id: 'memphis', name: 'Memphis', kind: SettlementKind.MetroArea, x: 900, y: 1022 },
    { id: 'dallas', name: 'Dallas', kind: SettlementKind.MetroArea, x: 537, y: 1242 },
    { id: 'topeka', name: 'Topeka', kind: SettlementKind.MercantileCenter, x: 183, y: 429 },
    {
        id: 'jefferson-city',
        name: 'Jefferson City',
        kind: SettlementKind.MercantileCenter,
        x: 705,
        y: 559
    },
    { id: 'wichita', name: 'Wichita', kind: SettlementKind.MercantileCenter, x: 156, y: 672 },
    { id: 'tulsa', name: 'Tulsa', kind: SettlementKind.MercantileCenter, x: 276, y: 865 },
    {
        id: 'oklahoma-city',
        name: 'Oklahoma City',
        kind: SettlementKind.MercantileCenter,
        x: 138,
        y: 954
    },
    {
        id: 'little-rock',
        name: 'Little Rock',
        kind: SettlementKind.MercantileCenter,
        x: 760,
        y: 1015
    },
    {
        id: 'fort-worth',
        name: 'Fort Worth',
        kind: SettlementKind.MercantileCenter,
        x: 370,
        y: 1204
    },
    { id: 'austin', name: 'Austin', kind: SettlementKind.MercantileCenter, x: 288, y: 1493 },
    { id: 'houston', name: 'Houston', kind: SettlementKind.MercantileCenter, x: 679, y: 1556 },
    {
        id: 'new-orleans',
        name: 'New Orleans',
        kind: SettlementKind.MercantileCenter,
        x: 939,
        y: 1555
    },
    { id: 'sedalia', name: 'Sedalia', kind: SettlementKind.RailroadStation, x: 467, y: 429 },
    { id: 'moberly', name: 'Moberly', kind: SettlementKind.RailroadStation, x: 604, y: 381 },
    { id: 'columbia', name: 'Columbia', kind: SettlementKind.RailroadStation, x: 680, y: 453 },
    { id: 'chanute', name: 'Chanute', kind: SettlementKind.RailroadStation, x: 264, y: 515 },
    { id: 'emporia', name: 'Emporia', kind: SettlementKind.RailroadStation, x: 104, y: 577 },
    { id: 'parsons', name: 'Parsons', kind: SettlementKind.RailroadStation, x: 338, y: 648 },
    { id: 'joplin', name: 'Joplin', kind: SettlementKind.RailroadStation, x: 527, y: 634 },
    {
        id: 'poplar-bluff',
        name: 'Poplar Bluff',
        kind: SettlementKind.RailroadStation,
        x: 773,
        y: 670
    },
    { id: 'osage', name: 'Osage', kind: SettlementKind.RailroadStation, x: 187, y: 797 },
    { id: 'muskogee', name: 'Muskogee', kind: SettlementKind.RailroadStation, x: 396, y: 852 },
    {
        id: 'fayetteville',
        name: 'Fayetteville',
        kind: SettlementKind.RailroadStation,
        x: 741,
        y: 889
    },
    { id: 'bishop', name: 'Bishop', kind: SettlementKind.RailroadStation, x: 359, y: 967 },
    {
        id: 'hot-springs',
        name: 'Hot Springs',
        kind: SettlementKind.RailroadStation,
        x: 561,
        y: 924
    },
    { id: 'fort-smith', name: 'Fort Smith', kind: SettlementKind.RailroadStation, x: 656, y: 979 },
    { id: 'denton', name: 'Denton', kind: SettlementKind.RailroadStation, x: 448, y: 1042 },
    {
        id: 'wichita-falls',
        name: 'Wichita Falls',
        kind: SettlementKind.RailroadStation,
        x: 224,
        y: 1080
    },
    { id: 'sherman', name: 'Sherman', kind: SettlementKind.RailroadStation, x: 357, y: 1089 },
    { id: 'greenville', name: 'Greenville', kind: SettlementKind.RailroadStation, x: 604, y: 1117 },
    { id: 'texarkana', name: 'Texarkana', kind: SettlementKind.RailroadStation, x: 755, y: 1155 },
    { id: 'mineola', name: 'Mineola', kind: SettlementKind.RailroadStation, x: 674, y: 1256 },
    { id: 'shreveport', name: 'Shreveport', kind: SettlementKind.RailroadStation, x: 836, y: 1281 },
    { id: 'rotan', name: 'Rotan', kind: SettlementKind.RailroadStation, x: 195, y: 1280 },
    { id: 'deleon', name: 'Deleon', kind: SettlementKind.RailroadStation, x: 411, y: 1320 },
    { id: 'stamford', name: 'Stamford', kind: SettlementKind.RailroadStation, x: 301, y: 1357 },
    { id: 'hillsboro', name: 'Hillsboro', kind: SettlementKind.RailroadStation, x: 619, y: 1355 },
    { id: 'abilene', name: 'Abilene', kind: SettlementKind.RailroadStation, x: 137, y: 1432 },
    { id: 'waco', name: 'Waco', kind: SettlementKind.RailroadStation, x: 529, y: 1430 },
    { id: 'granger', name: 'Granger', kind: SettlementKind.RailroadStation, x: 448, y: 1513 },
    {
        id: 'baton-rouge',
        name: 'Baton Rouge',
        kind: SettlementKind.RailroadStation,
        x: 818,
        y: 1414
    },
    {
        id: 'corpus-christi',
        name: 'Corpus Christi',
        kind: SettlementKind.RailroadStation,
        x: 433,
        y: 1695
    },
    {
        id: 'chanute-resource',
        name: 'Natural resource east of Chanute',
        kind: SettlementKind.NaturalResource,
        x: 367,
        y: 546
    },
    {
        id: 'emporia-resource',
        name: 'Natural resource east of Emporia',
        kind: SettlementKind.NaturalResource,
        x: 215,
        y: 597
    },
    {
        id: 'moberly-resource',
        name: 'Natural resource east of Moberly',
        kind: SettlementKind.NaturalResource,
        x: 702,
        y: 353
    },
    {
        id: 'joplin-resource-north',
        name: 'Natural resource north of Joplin',
        kind: SettlementKind.NaturalResource,
        x: 579,
        y: 540
    },
    {
        id: 'joplin-resource-east',
        name: 'Natural resource east of Joplin',
        kind: SettlementKind.NaturalResource,
        x: 616,
        y: 666
    },
    {
        id: 'poplar-bluff-resource-east',
        name: 'Natural resource east of Poplar Bluff',
        kind: SettlementKind.NaturalResource,
        x: 866,
        y: 657
    },
    {
        id: 'poplar-bluff-resource-south',
        name: 'Natural resource south of Poplar Bluff',
        kind: SettlementKind.NaturalResource,
        x: 842,
        y: 746
    },
    {
        id: 'parsons-resource',
        name: 'Natural resource south of Parsons',
        kind: SettlementKind.NaturalResource,
        x: 375,
        y: 747
    },
    {
        id: 'muskogee-resource',
        name: 'Natural resource east of Muskogee',
        kind: SettlementKind.NaturalResource,
        x: 483,
        y: 891
    },
    {
        id: 'greenville-resource-north',
        name: 'Natural resource north of Greenville',
        kind: SettlementKind.NaturalResource,
        x: 600,
        y: 1018
    },
    {
        id: 'greenville-resource-east',
        name: 'Natural resource east of Greenville',
        kind: SettlementKind.NaturalResource,
        x: 696,
        y: 1151
    },
    {
        id: 'fort-worth-resource',
        name: 'Natural resource north of Fort Worth',
        kind: SettlementKind.NaturalResource,
        x: 456,
        y: 1143
    },
    {
        id: 'rotan-resource',
        name: 'Natural resource north of Rotan',
        kind: SettlementKind.NaturalResource,
        x: 208,
        y: 1185
    },
    {
        id: 'mineola-resource',
        name: 'Natural resource north of Mineola',
        kind: SettlementKind.NaturalResource,
        x: 771,
        y: 1211
    },
    {
        id: 'hillsboro-resource-east',
        name: 'Natural resource east of Hillsboro',
        kind: SettlementKind.NaturalResource,
        x: 732,
        y: 1332
    },
    {
        id: 'hillsboro-resource-south',
        name: 'Natural resource south of Hillsboro',
        kind: SettlementKind.NaturalResource,
        x: 705,
        y: 1432
    },
    {
        id: 'deleon-resource',
        name: 'Natural resource south of Deleon',
        kind: SettlementKind.NaturalResource,
        x: 374,
        y: 1400
    },
    {
        id: 'granger-resource',
        name: 'Natural resource north of Granger',
        kind: SettlementKind.NaturalResource,
        x: 421,
        y: 1422
    },
    {
        id: 'houston-resource',
        name: 'Natural resource east of Houston',
        kind: SettlementKind.NaturalResource,
        x: 809,
        y: 1489
    },
    {
        id: 'corpus-christi-resource-west',
        name: 'Natural resource west of Corpus Christi',
        kind: SettlementKind.NaturalResource,
        x: 349,
        y: 1606
    },
    {
        id: 'corpus-christi-resource-east',
        name: 'Natural resource east of Corpus Christi',
        kind: SettlementKind.NaturalResource,
        x: 543,
        y: 1625
    }
]

export const LINKS: readonly LinkDefinition[] = [
    { id: 'kansas-city~topeka', ends: ['kansas-city', 'topeka'], box: { x: 252, y: 400 } },
    { id: 'kansas-city~sedalia', ends: ['kansas-city', 'sedalia'], box: { x: 413, y: 398 } },
    { id: 'chanute~kansas-city', ends: ['chanute', 'kansas-city'], box: { x: 299, y: 451 } },
    { id: 'junction-city~topeka', ends: ['junction-city', 'topeka'], box: { x: 122, y: 456 } },
    { id: 'chanute~topeka', ends: ['chanute', 'topeka'], box: { x: 220, y: 476 } },
    { id: 'chanute~junction-city', ends: ['chanute', 'junction-city'], box: { x: 160, y: 497 } },
    { id: 'chanute~sedalia', ends: ['chanute', 'sedalia'], box: { x: 375, y: 471 } },
    { id: 'emporia~junction-city', ends: ['emporia', 'junction-city'], box: { x: 81, y: 530 } },
    { id: 'chanute~emporia', ends: ['chanute', 'emporia'], box: { x: 194, y: 541 } },
    {
        id: 'chanute~chanute-resource',
        ends: ['chanute', 'chanute-resource'],
        box: { x: 317, y: 536 }
    },
    {
        id: 'emporia~emporia-resource',
        ends: ['emporia', 'emporia-resource'],
        box: { x: 165, y: 586 }
    },
    { id: 'emporia~wichita', ends: ['emporia', 'wichita'], box: { x: 127, y: 620 } },
    { id: 'chanute~parsons', ends: ['chanute', 'parsons'], box: { x: 305, y: 584 } },
    { id: 'parsons~wichita', ends: ['parsons', 'wichita'], box: { x: 246, y: 657 } },
    { id: 'joplin~parsons', ends: ['joplin', 'parsons'], box: { x: 436, y: 640 } },
    { id: 'moberly~sedalia', ends: ['moberly', 'sedalia'], box: { x: 541, y: 402 } },
    {
        id: 'moberly~moberly-resource',
        ends: ['moberly', 'moberly-resource'],
        box: { x: 657, y: 364 }
    },
    { id: 'columbia~moberly', ends: ['columbia', 'moberly'], box: { x: 636, y: 421 } },
    { id: 'columbia~st-louis', ends: ['columbia', 'st-louis'], box: { x: 763, y: 455 } },
    {
        id: 'columbia~jefferson-city',
        ends: ['columbia', 'jefferson-city'],
        box: { x: 684, y: 499 }
    },
    { id: 'jefferson-city~sedalia', ends: ['jefferson-city', 'sedalia'], box: { x: 584, y: 485 } },
    {
        id: 'jefferson-city~st-louis',
        ends: ['jefferson-city', 'st-louis'],
        box: { x: 770, y: 509 }
    },
    { id: 'joplin~sedalia', ends: ['joplin', 'sedalia'], box: { x: 496, y: 542 } },
    {
        id: 'joplin~joplin-resource-north',
        ends: ['joplin', 'joplin-resource-north'],
        box: { x: 557, y: 582 }
    },
    { id: 'jefferson-city~joplin', ends: ['jefferson-city', 'joplin'], box: { x: 624, y: 597 } },
    {
        id: 'joplin~joplin-resource-east',
        ends: ['joplin', 'joplin-resource-east'],
        box: { x: 575, y: 651 }
    },
    {
        id: 'jefferson-city~poplar-bluff',
        ends: ['jefferson-city', 'poplar-bluff'],
        box: { x: 743, y: 611 }
    },
    { id: 'poplar-bluff~st-louis', ends: ['poplar-bluff', 'st-louis'], box: { x: 810, y: 569 } },
    {
        id: 'poplar-bluff~poplar-bluff-resource-east',
        ends: ['poplar-bluff', 'poplar-bluff-resource-east'],
        box: { x: 807, y: 660 }
    },
    {
        id: 'poplar-bluff~poplar-bluff-resource-south',
        ends: ['poplar-bluff', 'poplar-bluff-resource-south'],
        box: { x: 809, y: 715 }
    },
    { id: 'osage~wichita', ends: ['osage', 'wichita'], box: { x: 164, y: 736 } },
    { id: 'osage~parsons', ends: ['osage', 'parsons'], box: { x: 266, y: 715 } },
    {
        id: 'parsons~parsons-resource',
        ends: ['parsons', 'parsons-resource'],
        box: { x: 359, y: 699 }
    },
    { id: 'osage~tulsa', ends: ['osage', 'tulsa'], box: { x: 218, y: 839 } },
    { id: 'oklahoma-city~osage', ends: ['oklahoma-city', 'osage'], box: { x: 142, y: 870 } },
    { id: 'muskogee~tulsa', ends: ['muskogee', 'tulsa'], box: { x: 341, y: 858 } },
    { id: 'joplin~muskogee', ends: ['joplin', 'muskogee'], box: { x: 463, y: 741 } },
    {
        id: 'muskogee~muskogee-resource',
        ends: ['muskogee', 'muskogee-resource'],
        box: { x: 443, y: 876 }
    },
    { id: 'muskogee~springfield', ends: ['muskogee', 'springfield'], box: { x: 513, y: 833 } },
    { id: 'oklahoma-city~tulsa', ends: ['oklahoma-city', 'tulsa'], box: { x: 210, y: 912 } },
    { id: 'bishop~tulsa', ends: ['bishop', 'tulsa'], box: { x: 318, y: 919 } },
    { id: 'bishop~oklahoma-city', ends: ['bishop', 'oklahoma-city'], box: { x: 249, y: 964 } },
    { id: 'bishop~hot-springs', ends: ['bishop', 'hot-springs'], box: { x: 457, y: 947 } },
    { id: 'bishop~denton', ends: ['bishop', 'denton'], box: { x: 403, y: 1006 } },
    { id: 'bishop~sherman', ends: ['bishop', 'sherman'], box: { x: 361, y: 1025 } },
    {
        id: 'oklahoma-city~wichita-falls',
        ends: ['oklahoma-city', 'wichita-falls'],
        box: { x: 183, y: 1017 }
    },
    { id: 'denton~hot-springs', ends: ['denton', 'hot-springs'], box: { x: 503, y: 987 } },
    { id: 'joplin~springfield', ends: ['joplin', 'springfield'], box: { x: 571, y: 728 } },
    {
        id: 'poplar-bluff~springfield',
        ends: ['poplar-bluff', 'springfield'],
        box: { x: 694, y: 747 }
    },
    {
        id: 'fayetteville~poplar-bluff',
        ends: ['fayetteville', 'poplar-bluff'],
        box: { x: 757, y: 778 }
    },
    {
        id: 'fayetteville~springfield',
        ends: ['fayetteville', 'springfield'],
        box: { x: 682, y: 856 }
    },
    {
        id: 'hot-springs~springfield',
        ends: ['hot-springs', 'springfield'],
        box: { x: 585, y: 875 }
    },
    { id: 'fort-smith~springfield', ends: ['fort-smith', 'springfield'], box: { x: 633, y: 908 } },
    { id: 'fort-smith~hot-springs', ends: ['fort-smith', 'hot-springs'], box: { x: 606, y: 955 } },
    {
        id: 'fayetteville~little-rock',
        ends: ['fayetteville', 'little-rock'],
        box: { x: 751, y: 945 }
    },
    { id: 'fayetteville~memphis', ends: ['fayetteville', 'memphis'], box: { x: 830, y: 937 } },
    { id: 'fort-smith~little-rock', ends: ['fort-smith', 'little-rock'], box: { x: 706, y: 1002 } },
    { id: 'little-rock~memphis', ends: ['little-rock', 'memphis'], box: { x: 828, y: 1021 } },
    { id: 'sherman~wichita-falls', ends: ['sherman', 'wichita-falls'], box: { x: 297, y: 1087 } },
    { id: 'denton~sherman', ends: ['denton', 'sherman'], box: { x: 407, y: 1076 } },
    { id: 'fort-worth~sherman', ends: ['fort-worth', 'sherman'], box: { x: 365, y: 1143 } },
    {
        id: 'fort-worth~wichita-falls',
        ends: ['fort-worth', 'wichita-falls'],
        box: { x: 285, y: 1153 }
    },
    {
        id: 'fort-worth~fort-worth-resource',
        ends: ['fort-worth', 'fort-worth-resource'],
        box: { x: 421, y: 1170 }
    },
    { id: 'dallas~fort-worth', ends: ['dallas', 'fort-worth'], box: { x: 448, y: 1220 } },
    { id: 'fort-worth~rotan', ends: ['fort-worth', 'rotan'], box: { x: 276, y: 1243 } },
    { id: 'rotan~rotan-resource', ends: ['rotan', 'rotan-resource'], box: { x: 199, y: 1231 } },
    { id: 'fort-worth~stamford', ends: ['fort-worth', 'stamford'], box: { x: 327, y: 1286 } },
    { id: 'deleon~fort-worth', ends: ['deleon', 'fort-worth'], box: { x: 382, y: 1265 } },
    { id: 'rotan~stamford', ends: ['rotan', 'stamford'], box: { x: 242, y: 1326 } },
    { id: 'deleon~stamford', ends: ['deleon', 'stamford'], box: { x: 358, y: 1340 } },
    { id: 'dallas~denton', ends: ['dallas', 'denton'], box: { x: 493, y: 1123 } },
    { id: 'denton~greenville', ends: ['denton', 'greenville'], box: { x: 533, y: 1073 } },
    {
        id: 'greenville~greenville-resource-north',
        ends: ['greenville', 'greenville-resource-north'],
        box: { x: 600, y: 1067 }
    },
    { id: 'greenville~little-rock', ends: ['greenville', 'little-rock'], box: { x: 683, y: 1066 } },
    {
        id: 'greenville~greenville-resource-east',
        ends: ['greenville', 'greenville-resource-east'],
        box: { x: 655, y: 1135 }
    },
    { id: 'dallas~greenville', ends: ['dallas', 'greenville'], box: { x: 575, y: 1162 } },
    { id: 'greenville~mineola', ends: ['greenville', 'mineola'], box: { x: 637, y: 1185 } },
    { id: 'little-rock~texarkana', ends: ['little-rock', 'texarkana'], box: { x: 755, y: 1086 } },
    { id: 'memphis~texarkana', ends: ['memphis', 'texarkana'], box: { x: 841, y: 1100 } },
    { id: 'mineola~texarkana', ends: ['mineola', 'texarkana'], box: { x: 714, y: 1202 } },
    { id: 'dallas~mineola', ends: ['dallas', 'mineola'], box: { x: 616, y: 1250 } },
    {
        id: 'mineola~mineola-resource',
        ends: ['mineola', 'mineola-resource'],
        box: { x: 727, y: 1236 }
    },
    { id: 'mineola~shreveport', ends: ['mineola', 'shreveport'], box: { x: 763, y: 1272 } },
    { id: 'hillsboro~mineola', ends: ['hillsboro', 'mineola'], box: { x: 642, y: 1306 } },
    { id: 'dallas~hillsboro', ends: ['dallas', 'hillsboro'], box: { x: 586, y: 1310 } },
    {
        id: 'hillsboro~hillsboro-resource-east',
        ends: ['hillsboro', 'hillsboro-resource-east'],
        box: { x: 680, y: 1342 }
    },
    { id: 'dallas~waco', ends: ['dallas', 'waco'], box: { x: 522, y: 1340 } },
    { id: 'baton-rouge~shreveport', ends: ['baton-rouge', 'shreveport'], box: { x: 827, y: 1350 } },
    { id: 'abilene~rotan', ends: ['abilene', 'rotan'], box: { x: 158, y: 1356 } },
    { id: 'austin~stamford', ends: ['austin', 'stamford'], box: { x: 297, y: 1409 } },
    { id: 'deleon~deleon-resource', ends: ['deleon', 'deleon-resource'], box: { x: 392, y: 1363 } },
    { id: 'deleon~waco', ends: ['deleon', 'waco'], box: { x: 468, y: 1376 } },
    { id: 'abilene~austin', ends: ['abilene', 'austin'], box: { x: 209, y: 1452 } },
    { id: 'abilene~san-antonio', ends: ['abilene', 'san-antonio'], box: { x: 154, y: 1527 } },
    { id: 'austin~san-antonio', ends: ['austin', 'san-antonio'], box: { x: 231, y: 1556 } },
    { id: 'austin~granger', ends: ['austin', 'granger'], box: { x: 369, y: 1491 } },
    {
        id: 'granger~granger-resource',
        ends: ['granger', 'granger-resource'],
        box: { x: 437, y: 1470 }
    },
    { id: 'granger~waco', ends: ['granger', 'waco'], box: { x: 481, y: 1474 } },
    { id: 'corpus-christi~granger', ends: ['corpus-christi', 'granger'], box: { x: 446, y: 1596 } },
    {
        id: 'corpus-christi~san-antonio',
        ends: ['corpus-christi', 'san-antonio'],
        box: { x: 310, y: 1664 }
    },
    {
        id: 'corpus-christi~corpus-christi-resource-west',
        ends: ['corpus-christi', 'corpus-christi-resource-west'],
        box: { x: 384, y: 1651 }
    },
    { id: 'hillsboro~waco', ends: ['hillsboro', 'waco'], box: { x: 581, y: 1395 } },
    {
        id: 'hillsboro~hillsboro-resource-south',
        ends: ['hillsboro', 'hillsboro-resource-south'],
        box: { x: 667, y: 1399 }
    },
    { id: 'houston~waco', ends: ['houston', 'waco'], box: { x: 601, y: 1485 } },
    { id: 'granger~houston', ends: ['granger', 'houston'], box: { x: 543, y: 1535 } },
    { id: 'baton-rouge~houston', ends: ['baton-rouge', 'houston'], box: { x: 755, y: 1468 } },
    {
        id: 'houston~houston-resource',
        ends: ['houston', 'houston-resource'],
        box: { x: 762, y: 1516 }
    },
    { id: 'houston~new-orleans', ends: ['houston', 'new-orleans'], box: { x: 821, y: 1552 } },
    {
        id: 'baton-rouge~new-orleans',
        ends: ['baton-rouge', 'new-orleans'],
        box: { x: 876, y: 1479 }
    },
    { id: 'galveston~houston', ends: ['galveston', 'houston'], box: { x: 697, y: 1618 } },
    { id: 'galveston~new-orleans', ends: ['galveston', 'new-orleans'], box: { x: 828, y: 1625 } },
    {
        id: 'corpus-christi~galveston',
        ends: ['corpus-christi', 'galveston'],
        box: { x: 584, y: 1691 }
    },
    {
        id: 'corpus-christi~corpus-christi-resource-east',
        ends: ['corpus-christi', 'corpus-christi-resource-east'],
        box: { x: 494, y: 1660 }
    }
]
