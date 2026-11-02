# Pressable: site types, the constant, and the operations

Pressable has three site types and one constant, and they are independent. The type is what
MyPressable and billing see; the constant is what WordPress sees. Linchpin uses the type for
cost and the constant for role, which is why a development environment is a *staging-type*
site whose constant says `development`.

## Site types

| Type | Counts against live sites | Custom domains | Password-protected | Linchpin uses it for |
| --- | --- | --- | --- | --- |
| live | yes | yes | no | production |
| staging | no | yes | no | staging **and** development |
| sandbox | no | no | yes, by an mu-plugin Pressable installs | nothing |

`search_sites` and `get_site_details` report `staging` true only for a staging-type site
that is not a sandbox, and `sandbox` separately. `list_sites` is the account-wide list and
is paginated; walk `last_page`.

Why a sandbox is never used:

- The password mu-plugin answers `401` on `/wp-json/safety-net/v1/status`, which Sisyphus
  polls before every night's run, and on the deploy health check.
- WordPress core's `wp_get_environment_type()` maps any value it does not know — and
  `sandbox` is one — to `production`. linchpin/actions' Safety Net installer requires
  `development` and refuses otherwise.
- Pressable will not attach a domain to a sandbox, so it can never answer on a
  `linchpin.build` hostname.

## The constant

`WP_ENVIRONMENT_TYPE` is written into `wp-config.php` by Pressable;
`update_site_wp_environment_type` is the only supported way to change it. Valid values are
`production`, `staging`, `development` and `local`.

Who reads it:

- **Safety Net** does nothing when it resolves to `production`. Its own fallback also
  accepts `sandbox`, `dev` and `develop`, but the deploy-time installer in linchpin/actions
  does not — it wants core to answer `development`.
- **linchpin/actions `deploy.yml`** refuses `safety_net: true` unless the GitHub environment
  is named `development` (any case) and the server reports `development`.
- **Mantle** reports it to api.linchpin.com as the site's `environment_type`; the api's
  `role` is the operator's statement and does not change when the report disagrees, which
  is exactly the `environment-type-mismatch` finding.

## The operations, in the order the procedure uses them

All through the Pressable MCP (`discover_tools` → `describe_tool` → `execute_tool`).

| Step | Operation | Parameters | Proves |
| --- | --- | --- | --- |
| Capacity | `get_account_site_counts` | — | Room for another staging-type site |
| Name | `validate_site_name` | `name` | `<slug>stg` / `<slug>dev` is free; 3–50 chars, lowercase, digits, hyphens |
| Clone | `clone_site` | `site_id` (production), `name`, `staging: true` | A copy with production's files and database; state `cloning` → `live` in minutes |
| Create empty | `create_site` | `name`, `staging: true`, `php_version` (match production) | A fresh install when there is nothing to clone yet |
| Wait | `get_site_status` | `site_id` | `state` is `live` |
| Type | `update_site_wp_environment_type` | `site_id`, `wp_environment_type` | `get_site_details` shows the role |
| Label | `update_site_display_name` | `site_id`, name `<Client> - <Role>` | Findable in MyPressable |
| Tag | `add_site_tags` | `site_id`, `tags: [{ name: <client> }]` | `list_sites` with `tag_name` returns the client's sites |
| Hostname | `add_site_domain` | `site_id`, `domain_name` | `list_site_domains` lists it; a person adds the A records |
| Verify | `get_site_details` | `site_id` | `staging: true`, `sandbox: false`, `wp_environment_type` right, `cloned_from_id` is production |

Never on the critical path: `convert_site_type`, `configure_site_basic_auth`,
`delete_site`, `disable_site`. If one seems necessary, the plan is wrong; stop and say why.

## Registering in api.linchpin.com

```http
POST /api/v1/environments
Authorization: Bearer <token with sites:write>

{
  "client_id": 20,
  "role": "development",
  "label": "ITCA dev",
  "hostname": "itcadev.linchpin.build",
  "provider": "pressable",
  "provider_ref": "1848726",
  "production_environment_id": 3,
  "github_repo": "linchpin/ideainfanttoddler",
  "deploy_environment": "Development",
  "deploy_branch": "maintenance"
}
```

`provider_ref` is the Pressable site id as a string and is unique across the api. A copy
must point at a production of the same client; the api refuses anything else. Fix a wrong
row with `PATCH /api/v1/environments/{id}` rather than creating a second one.

`GET /api/v1/environments/pressable` is the host's view joined to the register: any install
with `environment_id: null` is one nobody has registered, which `linchpin hosting ls
--unregistered` lists.

## Reading the audit

| Finding | Meaning | Usual fix |
| --- | --- | --- |
| `below-minimum` | Production has no copy at all | Procedure B — a gap |
| `missing-role` | No environment of that role points at this production | Procedure B, or record the decision — a warning |
| `copy-without-production` | A staging or development row with no `production_environment_id` the client owns | `PATCH` the row |
| `environment-type-mismatch` | Pressable's constant disagrees with the registered role | `update_site_wp_environment_type`, or correct the role if the register is wrong |
| `sandbox-install` | The copy is a sandbox | Recreate it as staging-type; a person decides whether to convert instead |
| `live-type-copy` | A copy is live-type and billed as such | A person converts it once its domains allow |
| `production-on-staging-type` | Production is a staging-type site | Convert before launch; usually a pre-launch build |
| `install-not-live` | Pressable reports the site disabled or deploying | Check MyPressable |
| `unregistered-install` | An install on the account no client owns | Register it, or leave it if it is not a client environment |
