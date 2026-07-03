export const JAPANESE_UPGRADE_POLICY = Object.freeze({
  preserve: Object.freeze({
    upperRail2000: Object.freeze({
      enabled: true,
      height: 2000,
      minHeight: 1800,
      maxHeight: 2100
    }),
    functionalShelf: Object.freeze({
      enabled: true,
      componentType: "woodShelf",
      minHeight: 1100,
      maxHeight: 1450,
      excludedZoneTypes: Object.freeze(["shoeZone"])
    }),
    shoeCapacity: Object.freeze({
      enabled: true,
      protectedRole: "shoeShelfZone",
      highRailShelfRemovalMinHeight: 900
    })
  }),
  lowerFunctionalZone: Object.freeze({
    lowerRail: Object.freeze({
      minHeight: 900,
      maxHeight: 1200,
      zoneType: "shortHangLowerRail"
    }),
    storageSupports: Object.freeze([
      "cabinet",
      "drawer",
      "drawerCabinet",
      "storageCabinet"
    ]),
    components: Object.freeze([
      "trouserRack",
      "jewelryBox",
      "mixedStorage",
      "cabinet",
      "drawer",
      "drawerCabinet",
      "storageCabinet"
    ])
  }),
  premiumFunctionalShelf: Object.freeze({
    oneFunctionalShelfPerLowerFunctionalZone: true,
    topMargin: 80,
    railGap: 140
  })
});
