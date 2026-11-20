import {
    SettlementKind,
    type ExternalConnectionDefinition,
    type LinkDefinition,
    type SettlementDefinition
} from '../types.js'

export const SETTLEMENTS: readonly SettlementDefinition[] = [
    {
        id: 'norvals-point',
        name: "Norval's Point",
        kind: SettlementKind.RailroadBase,
        x: 78,
        y: 882
    },
    { id: 'dreunberg', name: 'Dreunberg', kind: SettlementKind.RailroadStation, x: 136, y: 974 },
    {
        id: 'springfontein',
        name: 'Springfontein',
        kind: SettlementKind.RailroadStation,
        x: 166,
        y: 866
    },
    {
        id: 'koffiefontein',
        name: 'Koffiefontein',
        kind: SettlementKind.AgriculturalRailhead,
        x: 178,
        y: 672
    },
    {
        id: 'kimberley',
        name: 'Kimberley',
        kind: SettlementKind.RailroadBase,
        x: 211,
        y: 550
    },
    {
        id: 'aliwal-north',
        name: 'Aliwal North',
        kind: SettlementKind.RailroadBase,
        x: 223,
        y: 1019
    },
    { id: 'warrenton', name: 'Warrenton', kind: SettlementKind.RailroadStation, x: 301, y: 474 },
    { id: 'bloemfontein', name: 'Bloemfontein', kind: SettlementKind.MetroArea, x: 349, y: 750 },
    { id: 'purdimoe', name: 'Purdimoe', kind: SettlementKind.RailroadStation, x: 372, y: 371 },
    { id: 'watervliet', name: 'Watervliet', kind: SettlementKind.RailroadStation, x: 415, y: 844 },
    {
        id: 'bultfontein',
        name: 'Bultfontein',
        kind: SettlementKind.AgriculturalRailhead,
        x: 441,
        y: 633
    },
    { id: 'maseru', name: 'Maseru', kind: SettlementKind.AgriculturalRailhead, x: 480, y: 938 },
    { id: 'theunissen', name: 'Theunissen', kind: SettlementKind.RailroadStation, x: 506, y: 699 },
    {
        id: 'modderpoort',
        name: 'Modderpoort',
        kind: SettlementKind.RailroadStation,
        x: 526,
        y: 876
    },
    { id: 'maquassi', name: 'Maquassi', kind: SettlementKind.RailroadStation, x: 541, y: 496 },
    { id: 'winburg', name: 'Winburg', kind: SettlementKind.AgriculturalRailhead, x: 544, y: 781 },
    {
        id: 'ladybrand',
        name: 'Ladybrand',
        kind: SettlementKind.AgriculturalRailhead,
        x: 552,
        y: 956
    },
    { id: 'marquard', name: 'Marquard', kind: SettlementKind.AgriculturalRailhead, x: 569, y: 829 },
    { id: 'vermaas', name: 'Vermaas', kind: SettlementKind.RailroadStation, x: 620, y: 392 },
    {
        id: 'vierfontein',
        name: 'Vierfontein',
        kind: SettlementKind.RailroadStation,
        x: 654,
        y: 581
    },
    { id: 'mafeking', name: 'Mafeking', kind: SettlementKind.RailroadStation, x: 656, y: 250 },
    { id: 'kroonstad', name: 'Kroonstad', kind: SettlementKind.MercantileCenter, x: 656, y: 666 },
    { id: 'klerksdorp', name: 'Klerksdorp', kind: SettlementKind.RailroadStation, x: 657, y: 485 },
    { id: 'arlington', name: 'Arlington', kind: SettlementKind.RailroadStation, x: 668, y: 769 },
    {
        id: 'lichtenburg',
        name: 'Lichtenburg',
        kind: SettlementKind.AgriculturalRailhead,
        x: 686,
        y: 311
    },
    { id: 'coligny', name: 'Coligny', kind: SettlementKind.RailroadStation, x: 700, y: 392 },
    { id: 'bethlehem', name: 'Bethlehem', kind: SettlementKind.RailroadStation, x: 710, y: 853 },
    {
        id: 'potchefstroom',
        name: 'Potchefstroom',
        kind: SettlementKind.RailroadStation,
        x: 729,
        y: 533
    },
    {
        id: 'vredefort',
        name: 'Vredefort',
        kind: SettlementKind.AgriculturalRailhead,
        x: 729,
        y: 587
    },
    { id: 'dover', name: 'Dover', kind: SettlementKind.RailroadStation, x: 736, y: 668 },
    { id: 'harrismith', name: 'Harrismith', kind: SettlementKind.RailroadStation, x: 811, y: 935 },
    {
        id: 'welverdiend',
        name: 'Welverdiend',
        kind: SettlementKind.RailroadStation,
        x: 800,
        y: 480
    },
    {
        id: 'vereeniging',
        name: 'Vereeniging',
        kind: SettlementKind.MercantileCenter,
        x: 817,
        y: 626
    },
    { id: 'warden', name: 'Warden', kind: SettlementKind.AgriculturalRailhead, x: 838, y: 852 },
    {
        id: 'ladysmith',
        name: 'Ladysmith',
        kind: SettlementKind.RailroadBase,
        x: 846,
        y: 1038
    },
    {
        id: 'magaliesburg',
        name: 'Magaliesburg',
        kind: SettlementKind.RailroadStation,
        x: 864,
        y: 443
    },
    { id: 'vrede', name: 'Vrede', kind: SettlementKind.AgriculturalRailhead, x: 908, y: 837 },
    {
        id: 'johannesburg',
        name: 'Johannesburg',
        kind: SettlementKind.MetroArea,
        x: 918,
        y: 551
    },
    { id: 'boshoek', name: 'Boshoek', kind: SettlementKind.AgriculturalRailhead, x: 920, y: 362 },
    { id: 'balfour', name: 'Balfour', kind: SettlementKind.RailroadStation, x: 932, y: 685 },
    {
        id: 'glencoe-junction',
        name: 'Glencoe Junction',
        kind: SettlementKind.RailroadStation,
        x: 932,
        y: 1032
    },
    { id: 'newcastle', name: 'Newcastle', kind: SettlementKind.RailroadStation, x: 953, y: 955 },
    { id: 'sanderton', name: 'Sanderton', kind: SettlementKind.RailroadStation, x: 977, y: 767 },
    { id: 'volksrust', name: 'Volksrust', kind: SettlementKind.RailroadStation, x: 991, y: 869 },
    { id: 'pretoria', name: 'Pretoria', kind: SettlementKind.MercantileCenter, x: 995, y: 481 },
    { id: 'utrecht', name: 'Utrecht', kind: SettlementKind.AgriculturalRailhead, x: 1036, y: 970 },
    { id: 'vryheid', name: 'Vryheid', kind: SettlementKind.RailroadStation, x: 1043, y: 1035 },
    { id: 'bethal', name: 'Bethal', kind: SettlementKind.RailroadStation, x: 1057, y: 733 },
    {
        id: 'pienaarsriver',
        name: 'Pienaarsriver',
        kind: SettlementKind.RailroadStation,
        x: 1076,
        y: 449
    },
    { id: 'witbank', name: 'Witbank', kind: SettlementKind.RailroadStation, x: 1081, y: 638 },
    { id: 'ermelo', name: 'Ermelo', kind: SettlementKind.RailroadStation, x: 1116, y: 807 },
    { id: 'hlobane', name: 'Hlobane', kind: SettlementKind.AgriculturalRailhead, x: 1127, y: 1040 },
    { id: 'nylstroom', name: 'Nylstroom', kind: SettlementKind.RailroadStation, x: 1126, y: 384 },
    { id: 'breyten', name: 'Breyten', kind: SettlementKind.RailroadStation, x: 1135, y: 734 },
    {
        id: 'vaalwater',
        name: 'Vaalwater',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1140,
        y: 301
    },
    { id: 'belfast', name: 'Belfast', kind: SettlementKind.RailroadStation, x: 1157, y: 670 },
    { id: 'lothair', name: 'Lothair', kind: SettlementKind.AgriculturalRailhead, x: 1197, y: 820 },
    {
        id: 'naboomspruit',
        name: 'Naboomspruit',
        kind: SettlementKind.RailroadStation,
        x: 1205,
        y: 400
    },
    {
        id: 'marble-hall',
        name: 'Marble Hall',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1208,
        y: 505
    },
    {
        id: 'machadodorp',
        name: 'Machadodorp',
        kind: SettlementKind.RailroadStation,
        x: 1234,
        y: 706
    },
    {
        id: 'zebediela',
        name: 'Zebediela',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1287,
        y: 465
    },
    {
        id: 'barberton',
        name: 'Barberton',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1295,
        y: 825
    },
    { id: 'nelspruit', name: 'Nelspruit', kind: SettlementKind.RailroadStation, x: 1329, y: 750 },
    {
        id: 'pietersburg',
        name: 'Pietersburg',
        kind: SettlementKind.MercantileCenter,
        x: 1346,
        y: 411
    },
    {
        id: 'steelport',
        name: 'Steelport',
        kind: SettlementKind.AgriculturalRailhead,
        x: 1346,
        y: 588
    },
    { id: 'kaapmuiden', name: 'Kaapmuiden', kind: SettlementKind.RailroadStation, x: 1378, y: 827 },
    { id: 'graskop', name: 'Graskop', kind: SettlementKind.AgriculturalRailhead, x: 1388, y: 668 },
    { id: 'plaston', name: 'Plaston', kind: SettlementKind.AgriculturalRailhead, x: 1412, y: 744 },
    { id: 'zoekmakaar', name: 'Zoekmakaar', kind: SettlementKind.RailroadStation, x: 1441, y: 412 },
    {
        id: 'komatipoort',
        name: 'Komatipoort',
        kind: SettlementKind.RailroadStation,
        x: 1460,
        y: 853
    },
    {
        id: 'lourenco-marques',
        name: 'Lourenco Marques',
        kind: SettlementKind.RailroadBase,
        x: 1471,
        y: 988
    }
]

export const LINKS: readonly LinkDefinition[] = [
    { id: 'aliwal-north~dreunberg', ends: ['aliwal-north', 'dreunberg'], box: { x: 174, y: 1000 } },
    {
        id: 'aliwal-north~watervliet',
        ends: ['aliwal-north', 'watervliet'],
        box: { x: 370, y: 932 }
    },
    { id: 'arlington~bethlehem', ends: ['arlington', 'bethlehem'], box: { x: 696, y: 813 } },
    { id: 'arlington~kroonstad', ends: ['arlington', 'kroonstad'], box: { x: 661, y: 723 } },
    { id: 'arlington~marquard', ends: ['arlington', 'marquard'], box: { x: 617, y: 792 } },
    { id: 'arlington~vereeniging', ends: ['arlington', 'vereeniging'], box: { x: 775, y: 739 } },
    { id: 'balfour~bethlehem', ends: ['balfour', 'bethlehem'], box: { x: 815, y: 766 } },
    { id: 'balfour~johannesburg', ends: ['balfour', 'johannesburg'], box: { x: 914, y: 635 } },
    { id: 'balfour~sanderton', ends: ['balfour', 'sanderton'], box: { x: 959, y: 724 } },
    { id: 'balfour~vereeniging', ends: ['balfour', 'vereeniging'], box: { x: 874, y: 645 } },
    { id: 'barberton~kaapmuiden', ends: ['barberton', 'kaapmuiden'], box: { x: 1339, y: 827 } },
    { id: 'belfast~machadodorp', ends: ['belfast', 'machadodorp'], box: { x: 1195, y: 682 } },
    { id: 'belfast~steelport', ends: ['belfast', 'steelport'], box: { x: 1248, y: 626 } },
    { id: 'belfast~witbank', ends: ['belfast', 'witbank'], box: { x: 1119, y: 655 } },
    { id: 'bethal~breyten', ends: ['bethal', 'breyten'], box: { x: 1096, y: 732 } },
    { id: 'bethal~johannesburg', ends: ['bethal', 'johannesburg'], box: { x: 977, y: 646 } },
    { id: 'bethal~volksrust', ends: ['bethal', 'volksrust'], box: { x: 1057, y: 859 } },
    { id: 'bethlehem~harrismith', ends: ['bethlehem', 'harrismith'], box: { x: 756, y: 888 } },
    { id: 'bethlehem~modderpoort', ends: ['bethlehem', 'modderpoort'], box: { x: 618, y: 891 } },
    { id: 'bloemfontein~kimberley', ends: ['bloemfontein', 'kimberley'], box: { x: 256, y: 671 } },
    {
        id: 'bloemfontein~springfontein',
        ends: ['bloemfontein', 'springfontein'],
        box: { x: 239, y: 827 }
    },
    {
        id: 'bloemfontein~theunissen',
        ends: ['bloemfontein', 'theunissen'],
        box: { x: 430, y: 738 }
    },
    {
        id: 'bloemfontein~watervliet',
        ends: ['bloemfontein', 'watervliet'],
        box: { x: 385, y: 806 }
    },
    { id: 'boshoek~pretoria', ends: ['boshoek', 'pretoria'], box: { x: 962, y: 423 } },
    { id: 'breyten~ermelo', ends: ['breyten', 'ermelo'], box: { x: 1121, y: 772 } },
    { id: 'breyten~machadodorp', ends: ['breyten', 'machadodorp'], box: { x: 1178, y: 722 } },
    {
        id: 'bultfontein~vierfontein',
        ends: ['bultfontein', 'vierfontein'],
        box: { x: 554, y: 606 }
    },
    { id: 'coligny~lichtenburg', ends: ['coligny', 'lichtenburg'], box: { x: 700, y: 354 } },
    { id: 'coligny~vermaas', ends: ['coligny', 'vermaas'], box: { x: 660, y: 391 } },
    { id: 'coligny~welverdiend', ends: ['coligny', 'welverdiend'], box: { x: 739, y: 441 } },
    { id: 'dover~kroonstad', ends: ['dover', 'kroonstad'], box: { x: 697, y: 669 } },
    { id: 'dover~vereeniging', ends: ['dover', 'vereeniging'], box: { x: 775, y: 642 } },
    { id: 'dover~vredefort', ends: ['dover', 'vredefort'], box: { x: 733, y: 629 } },
    {
        id: 'dreunberg~springfontein',
        ends: ['dreunberg', 'springfontein'],
        box: { x: 156, y: 917 }
    },
    { id: 'ermelo~lothair', ends: ['ermelo', 'lothair'], box: { x: 1154, y: 816 } },
    { id: 'ermelo~vryheid', ends: ['ermelo', 'vryheid'], box: { x: 1134, y: 996 } },
    {
        id: 'glencoe-junction~ladysmith',
        ends: ['glencoe-junction', 'ladysmith'],
        box: { x: 894, y: 1038 }
    },
    {
        id: 'glencoe-junction~newcastle',
        ends: ['glencoe-junction', 'newcastle'],
        box: { x: 950, y: 994 }
    },
    {
        id: 'glencoe-junction~vryheid',
        ends: ['glencoe-junction', 'vryheid'],
        box: { x: 1003, y: 1033 }
    },
    { id: 'graskop~nelspruit', ends: ['graskop', 'nelspruit'], box: { x: 1359, y: 711 } },
    { id: 'harrismith~ladysmith', ends: ['harrismith', 'ladysmith'], box: { x: 823, y: 989 } },
    { id: 'harrismith~warden', ends: ['harrismith', 'warden'], box: { x: 824, y: 896 } },
    { id: 'hlobane~vryheid', ends: ['hlobane', 'vryheid'], box: { x: 1084, y: 1047 } },
    {
        id: 'johannesburg~magaliesburg',
        ends: ['johannesburg', 'magaliesburg'],
        box: { x: 880, y: 482 }
    },
    {
        id: 'johannesburg~potchefstroom',
        ends: ['johannesburg', 'potchefstroom'],
        box: { x: 806, y: 537 }
    },
    { id: 'johannesburg~pretoria', ends: ['johannesburg', 'pretoria'], box: { x: 987, y: 522 } },
    {
        id: 'johannesburg~vereeniging',
        ends: ['johannesburg', 'vereeniging'],
        box: { x: 839, y: 584 }
    },
    {
        id: 'johannesburg~welverdiend',
        ends: ['johannesburg', 'welverdiend'],
        box: { x: 840, y: 498 }
    },
    { id: 'johannesburg~witbank', ends: ['johannesburg', 'witbank'], box: { x: 1033, y: 614 } },
    { id: 'kaapmuiden~komatipoort', ends: ['kaapmuiden', 'komatipoort'], box: { x: 1418, y: 831 } },
    { id: 'kaapmuiden~nelspruit', ends: ['kaapmuiden', 'nelspruit'], box: { x: 1356, y: 788 } },
    { id: 'kimberley~warrenton', ends: ['kimberley', 'warrenton'], box: { x: 260, y: 513 } },
    { id: 'klerksdorp~maquassi', ends: ['klerksdorp', 'maquassi'], box: { x: 621, y: 519 } },
    {
        id: 'klerksdorp~potchefstroom',
        ends: ['klerksdorp', 'potchefstroom'],
        box: { x: 693, y: 509 }
    },
    { id: 'klerksdorp~vierfontein', ends: ['klerksdorp', 'vierfontein'], box: { x: 659, y: 544 } },
    {
        id: 'koffiefontein~springfontein',
        ends: ['koffiefontein', 'springfontein'],
        box: { x: 170, y: 767 }
    },
    {
        id: 'komatipoort~lourenco-marques',
        ends: ['komatipoort', 'lourenco-marques'],
        box: { x: 1470, y: 917 }
    },
    { id: 'komatipoort~zoekmakaar', ends: ['komatipoort', 'zoekmakaar'], box: { x: 1516, y: 551 } },
    { id: 'kroonstad~theunissen', ends: ['kroonstad', 'theunissen'], box: { x: 587, y: 688 } },
    { id: 'kroonstad~vierfontein', ends: ['kroonstad', 'vierfontein'], box: { x: 656, y: 621 } },
    { id: 'ladybrand~modderpoort', ends: ['ladybrand', 'modderpoort'], box: { x: 543, y: 913 } },
    { id: 'machadodorp~nelspruit', ends: ['machadodorp', 'nelspruit'], box: { x: 1274, y: 738 } },
    { id: 'mafeking~magaliesburg', ends: ['mafeking', 'magaliesburg'], box: { x: 822, y: 331 } },
    { id: 'mafeking~purdimoe', ends: ['mafeking', 'purdimoe'], box: { x: 433, y: 318 } },
    { id: 'magaliesburg~pretoria', ends: ['magaliesburg', 'pretoria'], box: { x: 920, y: 452 } },
    { id: 'maquassi~vermaas', ends: ['maquassi', 'vermaas'], box: { x: 570, y: 436 } },
    { id: 'maquassi~warrenton', ends: ['maquassi', 'warrenton'], box: { x: 446, y: 487 } },
    {
        id: 'marble-hall~pienaarsriver',
        ends: ['marble-hall', 'pienaarsriver'],
        box: { x: 1143, y: 477 }
    },
    { id: 'maseru~modderpoort', ends: ['maseru', 'modderpoort'], box: { x: 487, y: 894 } },
    { id: 'modderpoort~watervliet', ends: ['modderpoort', 'watervliet'], box: { x: 462, y: 848 } },
    { id: 'naboomspruit~nylstroom', ends: ['naboomspruit', 'nylstroom'], box: { x: 1166, y: 400 } },
    {
        id: 'naboomspruit~pietersburg',
        ends: ['naboomspruit', 'pietersburg'],
        box: { x: 1267, y: 403 }
    },
    { id: 'naboomspruit~zebediela', ends: ['naboomspruit', 'zebediela'], box: { x: 1228, y: 449 } },
    { id: 'nelspruit~plaston', ends: ['nelspruit', 'plaston'], box: { x: 1368, y: 749 } },
    { id: 'newcastle~utrecht', ends: ['newcastle', 'utrecht'], box: { x: 992, y: 965 } },
    { id: 'newcastle~volksrust', ends: ['newcastle', 'volksrust'], box: { x: 980, y: 912 } },
    {
        id: 'norvals-point~springfontein',
        ends: ['norvals-point', 'springfontein'],
        box: { x: 127, y: 877 }
    },
    {
        id: 'nylstroom~pienaarsriver',
        ends: ['nylstroom', 'pienaarsriver'],
        box: { x: 1111, y: 422 }
    },
    { id: 'nylstroom~vaalwater', ends: ['nylstroom', 'vaalwater'], box: { x: 1132, y: 345 } },
    { id: 'pienaarsriver~pretoria', ends: ['pienaarsriver', 'pretoria'], box: { x: 1036, y: 463 } },
    { id: 'pietersburg~zoekmakaar', ends: ['pietersburg', 'zoekmakaar'], box: { x: 1396, y: 408 } },
    {
        id: 'potchefstroom~welverdiend',
        ends: ['potchefstroom', 'welverdiend'],
        box: { x: 765, y: 507 }
    },
    { id: 'pretoria~witbank', ends: ['pretoria', 'witbank'], box: { x: 1073, y: 562 } },
    { id: 'purdimoe~vermaas', ends: ['purdimoe', 'vermaas'], box: { x: 507, y: 380 } },
    { id: 'purdimoe~warrenton', ends: ['purdimoe', 'warrenton'], box: { x: 346, y: 424 } },
    { id: 'sanderton~volksrust', ends: ['sanderton', 'volksrust'], box: { x: 988, y: 813 } },
    { id: 'sanderton~vrede', ends: ['sanderton', 'vrede'], box: { x: 940, y: 794 } },
    { id: 'theunissen~winburg', ends: ['theunissen', 'winburg'], box: { x: 524, y: 737 } }
]

export const EXTERNAL_CONNECTIONS: readonly ExternalConnectionDefinition[] = [
    {
        id: 'bechuanaland',
        name: 'Bechuanaland',
        settlementId: 'mafeking',
        price: 30,
        value: 40,
        x: 657,
        y: 203
    },
    {
        id: 'matabeleland',
        name: 'Matabeleland',
        settlementId: 'zoekmakaar',
        price: 40,
        value: 30,
        x: 1443,
        y: 346
    }
]
