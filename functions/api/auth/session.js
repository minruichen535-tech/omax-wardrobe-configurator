import {
  blockedMessage,
  createClearSessionCookie,
  dealerAuthErrorCode,
  dealerProfileSnapshot,
  destroySession,
  getDealerPermissions,
  getDealerProfile,
  getSessionAccount
} from "../../_lib/auth.js";
import { json } from "../../_lib/http.js";

export async function onRequestGet(context) {
  const account = await getSessionAccount(context.env, context.request);
  if (!account) return json({ authenticated: false }, { status: 401 });
  if (account.blockedReason) {
    await destroySession(context.env.DB, context.request);
    return json({
      authenticated: false,
      error: dealerAuthErrorCode(account.blockedReason),
      message: blockedMessage(account.blockedReason)
    }, {
      status: 403,
      headers: { "set-cookie": createClearSessionCookie() }
    });
  }
  const response = {
    authenticated: true,
    account: {
      id: account.id,
      username: account.username,
      role: account.role,
      status: account.status,
      expiresAt: account.expiresAt || ""
    }
  };
  if (account.role === "dealer") {
    const profile = await getDealerProfile(context.env.DB, account.id);
    response.dealerProfile = dealerProfileSnapshot(profile);
    response.permissions = await getDealerPermissions(context.env.DB, account.id);
  }
  return json(response);
}
