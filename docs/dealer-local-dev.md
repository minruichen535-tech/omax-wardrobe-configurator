# Dealer Admin Local Development

Do not use `python -m http.server` for Dealer Admin or dealer authentication testing. It can only serve static files, so `/api/*` requests return static-server errors instead of Cloudflare Pages Functions JSON.

## Clean Terminal Workflow

```bash
cd /Users/ray/omax-wardrobe-configurator
npm exec -- wrangler --version
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and set a local-only bootstrap token:

```bash
ADMIN_BOOTSTRAP_TOKEN=local-dev-bootstrap-token
```

Apply the local D1 migration:

```bash
npm exec -- wrangler d1 migrations apply omax-wardrobe-local --local
```

If Wrangler prompts for confirmation, answer `y`.

Start Cloudflare Pages local development:

```bash
npm exec -- wrangler pages dev . --port 8788 --local
```

Bootstrap the first local admin account once:

```bash
curl -X POST http://127.0.0.1:8788/api/admin/bootstrap \
  -H "content-type: application/json" \
  -H "x-bootstrap-token: local-dev-bootstrap-token" \
  --data '{"username":"admin@example.com","password":"change-this-admin-password"}'
```

Then sign in through:

- Admin login: http://127.0.0.1:8788/admin/login/
- Dealer Admin: http://127.0.0.1:8788/admin/dealers/
- Dealer login: http://127.0.0.1:8788/dealer/login/
- Dealer portal: http://127.0.0.1:8788/dealer/

## Notes

- `.dev.vars` must stay local and must not contain production secrets.
- `wrangler.toml` provides the local Pages Functions and D1 binding named `DB`.
- Production D1 should continue to be configured with the real Cloudflare database binding, not the local placeholder ID.
