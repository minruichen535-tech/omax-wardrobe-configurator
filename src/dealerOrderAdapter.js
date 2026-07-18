const dealerOrdersStorageKey = "purenestDealerOrders";

function readStoredDealerOrders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(dealerOrdersStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((order) => order && typeof order === "object") : [];
  } catch (error) {
    console.warn("[dealer orders] invalid payload", error);
    return [];
  }
}

function writeStoredDealerOrders(orders) {
  localStorage.setItem(dealerOrdersStorageKey, JSON.stringify(orders));
}

export function readDealerOrders() {
  return readStoredDealerOrders();
}

export async function submitDealerOrder(order) {
  const response = await fetch("/api/dealer/orders", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(order)
  });
  if (!response.ok) {
    const error = new Error("dealer_order_submit_failed");
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  return payload.order;
}
