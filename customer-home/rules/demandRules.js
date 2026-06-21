export function calculateDemandZones(needs) {

  const result = {
    shortHangZone: 0,
    longHangZone: 0,
    shoeZone: 0,
    bagZone: 0,
    luggageZone: 0,
    jewelryZone: 0
  };

  if (needs.shortClothes > 0) {
    result.shortHangZone =
      Math.ceil(needs.shortClothes / 30) * 900;
  }

  if (needs.longClothes > 0) {
    result.longHangZone =
      Math.ceil(needs.longClothes / 20) * 900;
  }

  if (needs.shoes > 0) {
    result.shoeZone =
      Math.ceil(needs.shoes / 10) * 500;
  }

  if (needs.bags > 0) {
    result.bagZone =
      Math.ceil(needs.bags / 4) * 600;
  }

  return result;
}