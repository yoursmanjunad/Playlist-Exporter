# Ship Your Playlists
This is an open-source project to transport all your playlists from `Spotify` to `YouTube`.

## API documentation

The complete OpenAPI 3.1 contract and integration guide are in [docs/API.md](docs/API.md). Import [docs/openapi.yaml](docs/openapi.yaml) into Postman, Insomnia, or Swagger UI.


Development Plan for Matching Engine
- Done with fetching user's spotify playlists and tracks.
This is how the matching engine works. 
- User selects the playlist. 
- Pull those tracks and save to DB
- Build a query for each song and save them to DB


I’ll trace the existing subscription model, auth/session conventions, and environment setup first, then add a focused Stripe billing flow: checkout session creation, customer portal, webhook synchronization, and subscription-aware session handling. I’ll keep Stripe secrets server-side and make the implementation safe when Stripe is not configured.



Searched for regex `subscription|premium|usage|session|stripe|billing` (`**/src/**`), 21 results

Read 

Read 

Search complete: Trace Stripe billing surfaces

Read 

Searched codebase for "subscription billing schema model Stripe checkout portal webhook", 22 results

Searched codebase for "auth session flow token validation subscription-aware sessions", 19 results

Searched codebase for "env configuration environment variables secrets", 20 results

Searched codebase for "route mounting app/dependency package conventions", 23 results

Searched for files matching `**/*subscription*`, 1 match

Searched for files matching `**/*billing*`, no matches

Searched for files matching `**/*stripe*`, no matches

Searched for files matching `**/*session*`, no matches

Searched for files matching `**/*auth*`, 10 matches

Searched for files matching `**/docs/**`, 2 matches

Searched for files matching `**/subscription*`, 1 match

Searched for files matching `**/oauth*`, 3 matches

Searched for files matching `**/auth*`, 6 matches

Searched for files matching `**/route*`, no matches

Searched for files matching `**/stripe*`, no matches

Searched for files matching `**/webhook*`, no matches

Searched for files matching `**/session*`, no matches

Searched for files matching `**/docs/**`, 2 matches

Searched for text `subscription`, 14 results

Searched for regex `Stripe|stripe|webhook|checkout|portal`, 8 results

Searched for regex `session|session-aware|subscription-aware`, 26 results

Searched for files matching `**/*stripe*`, no matches

Searched for files matching `**/*subscription*`, 1 match

Searched for files matching `**/*oauth*`, 4 matches

Searched for files matching `**/*auth*`, 10 matches

Read 

The repo has subscription fields but no Stripe integration, and the current subscription model has a schema-construction bug (`Schema` is imported as the Mongoose default). I’ll implement the billing boundary cleanly: checkout and portal sessions for authenticated users, a billing-status endpoint, raw-body webhook verification, durable subscription upserts, and session cookies that remain valid while subscription state is refreshed from the database.

Generating patch (295 lines) in , , , 


```

```

```

```

```

```

```

```
The Stripe surface is now added, but I’m tightening two integration details before validation: the webhook must receive Stripe’s raw request body before Express JSON parsing, and Stripe can emit statuses beyond the model’s original enum. I’ll wire the route order, normalize supported statuses, add environment documentation, and install the SDK.

Apply Patch

The combined patch was rejected because the OpenAPI insertion context did not match, so no files were changed by that attempt. I’m splitting the implementation into smaller edits now, starting with runtime-critical route ordering and dependency/config changes, then I’ll patch documentation against exact nearby anchors.

Apply Patch

Read 

Read 

Read , lines 12 to 33

Generating patch (31 lines) in , , , 


```

```

```

```

```

```

```

```


Ran terminal command: Test-Path src/controllers/billing.controllers.js; Test-Path src/routes/billing.routes.js; Test-Path src/services/billing/stripe.service.js

Read 

Read 

Read 

Generating patch (23 lines) in 

Generating patch (18 lines) in 


```

```


Ran terminal command: npm install

Read , lines 1 to 20

Read , lines 320 to 370

Read , lines 370 to 405

Generating patch (79 lines) in , 

Searched for text `The response includes` (`**/docs/API.md`), 1 result

Generating patch (16 lines) in 


```

```


Generating patch (56 lines) in 


```

```


Ran terminal command: npm install; node --check src/controllers/billing.controllers.js; node --check src/services/billing/stripe.service.js; node --check src/routes/billing.routes.js; node --check src/app.js; node --test tests/*.test.js

Stripe is installed and the full existing suite passes. I’m adding the last guardrails for a better billing experience: reject unknown plan values and prevent creating a second Checkout subscription when the user already has an active or trialing one.

Generating patch (20 lines) in 


```

```


Generating patch (8 lines) in 


```

```


Ran terminal command: node --check src/controllers/billing.controllers.js; node --check src/models/subscription.models.js; node --check src/app.js; node --test tests/*.test.js

Ran terminal command: git diff --stat; git status --short

Checked , , , , no problems found

Implemented Stripe subscription billing.

### Added routes

- `GET /api/billing/status`
- `POST /api/billing/checkout-session`
- `POST /api/billing/portal-session`
- `POST /api/billing/webhook`

### Features

- Monthly and yearly premium plans
- Stripe Checkout sessions
- Stripe Customer Portal sessions
- Stripe customer creation and reuse
- Duplicate subscription prevention
- Signed webhook verification
- Subscription synchronization for:
  - Checkout completion
  - Subscription creation/update/cancellation
  - Failed payments
- User subscription snapshot updates for `/api/auth/get-me`
- Correct raw-body handling for Stripe webhooks
- Fixed the subscription model schema bug
- Graceful `503` responses when Stripe is not configured

Add these backend environment variables:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_...
STRIPE_PREMIUM_YEARLY_PRICE_ID=price_...
```

Frontend Checkout example:

```js
const response = await fetch(
  "http://localhost:5000/api/billing/checkout-session",
  {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan: "premium_monthly",
    }),
  }
);

const { checkoutUrl } = await response.json();
window.location.href = checkoutUrl;
```

After Stripe redirects back, call:

```js
fetch("http://localhost:5000/api/billing/status", {
  credentials: "include",
});
```

All 5 existing tests, syntax checks, and diagnostics pass.

Made changes.