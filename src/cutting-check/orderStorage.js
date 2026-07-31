const DRAFT_STORAGE_KEY = "omax-cutting-check-draft-v1";
const ORDERS_STORAGE_KEY = "omax-cutting-check-orders-v1";

/**
 * 读取当前设备上的自动保存草稿。
 * @returns {object|null}
 */
export function loadOrderDraft() {
  return readJson(DRAFT_STORAGE_KEY, null);
}

/**
 * 自动保存当前草稿，不改变订单字段内容。
 * @param {object} order 当前订单
 */
export function saveOrderDraft(order) {
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(order));
}

/**
 * 读取当前设备上明确保存的订单列表。
 * @returns {object[]}
 */
export function listSavedOrders() {
  const orders = readJson(ORDERS_STORAGE_KEY, []);
  return Array.isArray(orders) ? orders : [];
}

/**
 * 新增或覆盖同一内部 id 的本地订单快照。
 * @param {object} order 当前订单
 * @returns {object[]}
 */
export function saveOrderSnapshot(order) {
  const orders = listSavedOrders();
  const savedAt = new Date().toISOString();
  const snapshot = structuredClone({ ...order, savedAt });
  const index = orders.findIndex((item) => item.id === order.id);
  if (index >= 0) orders[index] = snapshot;
  else orders.unshift(snapshot);
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  return orders;
}

/**
 * 删除指定内部 id 的本地订单快照。
 * @param {string} orderId 订单内部 id
 * @returns {object[]}
 */
export function deleteOrderSnapshot(orderId) {
  const orders = listSavedOrders().filter((item) => item.id !== orderId);
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  return orders;
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
