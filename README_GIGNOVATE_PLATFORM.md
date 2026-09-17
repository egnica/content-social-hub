# GIGNovate Platform Vision

This document captures a broader product direction that grows out of the Content Social Hub and the existing CRM work. It is intentionally separate from `README.md`, which remains the implementation source of truth for the current social content application.

The idea is to evolve GIGNovate from primarily a service/agency concept into a software-first small-business platform that connects customer relationships, outreach, content, campaigns, and local marketing in one place.

---

## Core Product Idea

GIGNovate could become an all-in-one marketing and relationship hub for a small business.

Instead of asking a business owner to manage separate tools for:

- customer/contact records
- HTML email
- newsletters
- physical letters
- postcards
- social media content
- social scheduling
- blog publishing
- local SEO content
- campaign coordination
- reporting

GIGNovate would organize those activities around one business workspace and one shared data model.

The goal is not simply to put several tools beside each other. The stronger idea is to let the same customer data, content, campaign, location, and schedule flow through multiple channels.

---

## Example Small-Business Use Case

A cleaning company in Bloomington could use GIGNovate to:

1. Keep its customers and prospects in the CRM.
2. Send an HTML email or newsletter to selected contacts.
3. Send a physical letter or postcard through Lob.
4. Create a social campaign around the same promotion or business activity.
5. Schedule Facebook, Instagram, LinkedIn, or other supported posts.
6. Create a related blog post from the same Master Content package.
7. Tag the content with `Bloomington` as a real service/location context.
8. Use that location data to help create useful locally relevant website content.
9. Coordinate the timing of the email, mail piece, blog post, and social posts as one campaign.
10. Review results from the campaign inside the same application.

The customer should experience this as one workflow, even though several third-party services may operate behind the scenes.

---

## Product Model

A GIGNovate account should be organized around **Business Workspaces**.

A workspace represents one business managing its own customers, communications, content, and channels.

This model can also support an agency or consultant later by allowing one account to have access to multiple business workspaces.

```text
GIGNovate Account
  -> Business Workspace
      -> Contacts / CRM
      -> Campaigns
      -> Email
      -> Direct Mail
      -> Content
      -> Social Accounts
      -> Blog / Website Connections
      -> Locations
      -> Analytics / Activity
```

The product should feel like one business managing its own world, rather than an agency dashboard that happens to contain many clients.

---

## CRM / Relationship Layer

The CRM becomes the shared relationship layer underneath the rest of the platform.

Possible records include:

- prospects
- customers
- former customers
- partners
- vendors
- referral sources
- organizations
- contact people

Useful fields may include:

- name
- company
- email
- phone
- mailing address
- tags
- customer status
- location
- notes
- communication history
- campaign history
- subscription / opt-out status

The important part is that a contact should not exist only for email. The same person or organization can participate in email, physical mail, campaigns, and other workflows.

---

## Email

Email could include multiple levels of communication:

### Individual / semi-bulk HTML email

Useful for targeted communication to one person or a selected group.

Examples:

- follow-up
- announcement
- customer update
- personalized outreach

### Newsletter / campaign email

Useful for larger permission-based audiences.

Possible features:

- templates
- audience selection
- test send
- scheduled send
- unsubscribe handling
- delivery status
- opens / clicks where available and appropriate
- campaign association

### Resend integration concept

GIGNovate can use a server-side Resend integration rather than requiring every customer to manage application API keys.

Conceptually:

```text
GIGNovate server
  -> platform Resend credentials
  -> verified customer domains
  -> customer-specific sender identities
```

A business owner should never need to paste a Resend API key into GIGNovate.

The onboarding challenge is domain verification. A customer may need to authorize DNS changes with their domain/DNS provider.

The product can make this easier by asking for the provider and showing provider-specific instructions for common services such as:

- GoDaddy
- Wix
- Squarespace
- Cloudflare
- Shopify
- WordPress hosting providers
- other common DNS hosts

Where supported, a more automated domain connection flow can be added later.

---

## Physical Mail

Physical mail should be treated as a **channel inside a campaign**, not as a Lob-specific feature.

There are two distinct direct-mail modes GIGNovate should support:

### 1. Addressed Direct Mail

Use when GIGNovate knows the recipient or has a mailing list.

Examples:

- customer letters
- prospect letters
- postcards to known contacts
- personalized lifecycle mail
- follow-up after an inquiry
- targeted acquisition lists

The CRM supplies the recipient data, and the campaign determines the creative, schedule, and tracking.

### 2. Neighborhood / Saturation Mail

Use when the business wants to reach an area rather than a known list.

The important USPS model is **Every Door Direct Mail (EDDM)**. A business selects USPS carrier routes and reaches every deliverable household on those routes without needing an individual address list.

This is especially relevant for local businesses such as:

- cleaning companies
- restaurants
- landscapers
- home-service companies
- real-estate businesses
- local retail
- neighborhood events

Example:

```text
Campaign: Spring Cleaning — Bloomington

Audience
  -> Existing customers by email
  -> Existing customers by postcard
  -> New households in selected Bloomington carrier routes

Content
  -> Blog post
  -> Email campaign
  -> Addressed postcard
  -> EDDM neighborhood postcard
  -> Facebook / Instagram / LinkedIn posts

Schedule
  -> Blog publishes Monday
  -> Email sends Tuesday
  -> Neighborhood mail launches Tuesday
  -> Social posts run throughout the following week
```

### Mail-provider strategy

GIGNovate should **not** hard-code the product around Lob.

Lob can remain useful for the current CRM and addressed-mail workflows, but the long-term GIGNovate architecture should use a provider-neutral mail layer.

Conceptually:

```text
GIGNovate Campaign
  -> Mail Service
      -> Addressed Mail Provider
      -> EDDM / Neighborhood Mail Provider
```

or, when one provider supports both:

```text
GIGNovate Campaign
  -> Mail Provider
      -> Addressed Direct Mail
      -> EDDM
```

That keeps the GIGNovate user experience stable even if the fulfillment vendor changes.

### Providers to evaluate

#### Oppizi

Oppizi is currently a strong candidate for the broader GIGNovate direction because its current developer platform explicitly supports both:

- **ADM** — addressed direct mail to a customer/address list
- **EDDM** — USPS carrier-route saturation without an address list

Its EDDM workflow can programmatically:

- create a draft campaign
- select a city
- select USPS carrier routes
- attach a design
- select the mail format
- set a launch date
- calculate an estimated price
- submit the campaign for review

Oppizi's model is especially interesting because it already thinks in terms of **campaigns, targeting, creative, cost, launch date, and performance**, which maps closely to the GIGNovate campaign model.

#### PostGrid

PostGrid is another serious candidate. Its Print & Mail API supports letters, postcards, campaigns, address verification, tracking, and a USPS EDDM mailing class.

PostGrid may be particularly useful if GIGNovate needs a broader transactional-mail and address-verification layer in addition to marketing campaigns.

#### Lob

Lob remains a good addressed-mail provider and can continue powering the existing CRM implementation.

The architectural decision should be:

> **Keep Lob where it already works, but do not make Lob a permanent dependency of the GIGNovate product model.**

Before the larger platform is implemented, compare Oppizi, PostGrid, and Lob on:

- addressed-mail capabilities
- EDDM / carrier-route targeting
- API quality
- test / sandbox support
- pricing
- letters vs postcards
- address verification
- tracking
- webhooks
- campaign analytics
- multi-tenant / SaaS suitability
- billing and funding requirements

### Mail billing / credits

The customer-facing balance should belong to GIGNovate, not to the mail vendor.

Possible flow:

```text
Customer pays GIGNovate through Stripe
  -> GIGNovate records available mail balance / usage credit
  -> campaign estimates cost
  -> customer approves campaign
  -> GIGNovate submits to selected mail provider
  -> actual provider cost is recorded
  -> GIGNovate decrements the customer's balance
```

Stripe does not need to directly pay Lob, Oppizi, or PostGrid for each customer transaction.

GIGNovate can keep customer billing and provider funding as separate accounting layers. This also makes it possible to change mail providers without changing the customer's payment workflow.

GIGNovate should track:

- recipient or target area
- carrier routes where applicable
- campaign
- mail type
- provider
- submission date
- launch / send date
- expected delivery
- delivery / campaign status
- failures / returns where available
- estimated cost
- actual cost
- customer charge
- provider reference ID
- campaign performance where available

---

## Social Media

The existing Content Social Hub becomes the social/content layer of the larger product.

The core **Master Content** concept remains valuable because one idea can produce multiple channel-specific versions.

```text
Master Content
  -> Facebook version
  -> Instagram version
  -> LinkedIn version
  -> YouTube version
  -> Blog version
  -> Email version
  -> Direct-mail creative / copy
```

Not every content package needs every channel.

The system should help the user choose the appropriate destinations and then adapt the content rather than blindly duplicating the same text everywhere.

---

## Blog / Website Publishing

Blog should be treated as another content destination.

A blog destination may contain fields such as:

- title
- slug
- excerpt
- body
- primary image
- image alt text
- author
- publish date
- SEO title
- meta description
- canonical URL
- location associations
- service associations
- campaign association

GIGNovate should not require every connected website to use the same database technology.

Instead, GIGNovate can be the central source of truth and publish through an adapter/API for each connected website.

Possible flow:

```text
GIGNovate Master Content
  -> Blog Version
  -> Website Connector / API
  -> Website publishes post
  -> Website returns URL + publish status
```

The connected website could use MongoDB, Postgres, Supabase, a CMS, static content, or another storage model.

---

## Local SEO Layer

Location can become a first-class content attribute.

For example, if a cleaning business performed work in Bloomington, the content package might include:

```text
Location: Bloomington, Minnesota
Service: Residential Cleaning
```

That information can help generate useful local content for the blog and social channels.

The goal should **not** be to create thin pages that simply swap city names.

The stronger model is to capture real business activity and use it to create genuinely relevant local content.

Possible local fields:

- city
- neighborhood
- state
- service area
- service performed
- project / activity type
- related business location
- related landing page

Over time, GIGNovate could help a business build a structured body of locally relevant content while keeping the source information tied to real activity.

---

## Campaigns as the Connecting Object

Campaigns may become the most important object connecting all of the modules.

Instead of thinking:

```text
send an email
send a postcard
publish a blog post
post on Instagram
```

GIGNovate can think:

```text
Campaign: Fall Cleaning Promotion

Audience
  -> existing residential customers

Channels
  -> Email newsletter
  -> Postcard
  -> Blog post
  -> Facebook
  -> Instagram
  -> LinkedIn

Schedule
  -> Blog publishes Monday
  -> Email sends Tuesday
  -> Postcard drops Tuesday
  -> Social posts publish throughout the week
```

This is where the modules become more valuable together than they are separately.

A campaign could contain:

- campaign name
- objective
- audience
- locations
- services / products
- Master Content packages
- email sends
- physical mail sends
- social posts
- blog posts
- start / end dates
- schedule
- status
- results

---

## Shared Data Model

A relational model may become increasingly useful as the platform expands because many objects relate to one another.

Potential high-level entities:

```text
Account
BusinessWorkspace
User
Contact
Organization
Address
Location
Campaign
MasterContent
ContentVersion
MediaAsset
SocialConnection
WebsiteConnection
EmailDomain
EmailMessage
EmailCampaign
DirectMailPiece
ScheduleItem
PublishEvent
ActivityEvent
AnalyticsEvent
```

Possible relationships:

```text
BusinessWorkspace
  has many Contacts
  has many Campaigns
  has many SocialConnections
  has many WebsiteConnections
  has many Locations

Campaign
  has many MasterContent packages
  has many EmailMessages
  has many DirectMailPieces
  has many ScheduleItems

MasterContent
  has many ContentVersions
  has many MediaAssets
  can belong to Campaign
  can reference Locations
```

Supabase/Postgres is worth considering for the long-term platform because the system is naturally relational. MongoDB can remain appropriate for existing applications and does not need to be replaced merely for consistency.

Database migration should be driven by product needs rather than by a desire to rewrite working code.

---

## Integrations

Potential integrations include:

### Current / likely early integrations

- Resend — transactional and campaign email
- Mail provider abstraction
  - Lob — existing addressed-mail implementation
  - Oppizi — candidate for addressed mail + EDDM / neighborhood campaigns
  - PostGrid — candidate for addressed mail + EDDM + address verification
- Meta — Facebook / Instagram
- LinkedIn
- YouTube
- website/blog APIs
- AWS S3 — media storage
- Stripe — subscription billing, usage billing, and prepaid campaign balances

### Possible later integrations

- Google Business Profile
- Google Analytics
- Google Search Console
- domain/DNS connection services
- additional social networks
- additional email providers if needed
- additional print / mail fulfillment providers

Third-party products should generally be invisible infrastructure. The user should think in terms of **Send Email**, **Mail Postcard**, **Reach a Neighborhood**, **Publish Blog**, and **Schedule Post**, not Resend API, Lob API, carrier-route APIs, OAuth scopes, or DNS records.

The integration architecture should favor adapters around third-party services so GIGNovate owns the workflow while vendors remain replaceable infrastructure.

---

## Billing Concept

A future GIGNovate subscription could combine a base software subscription with usage-based services.

Possible structure:

```text
Monthly subscription
  -> CRM
  -> content management
  -> social scheduling
  -> campaign tools
  -> basic email allowance

Usage
  -> additional email volume
  -> physical mail / postcards
  -> storage
  -> premium AI or analytics features
```

The exact pricing model should be tested later. The important architectural principle is to track third-party usage by workspace from the beginning where practical.

---

## Product Differentiation

Many products already offer some combination of CRM, email, social scheduling, and marketing automation.

The potential GIGNovate differentiation is the workflow created by combining:

- lightweight CRM
- email
- physical direct mail
- social publishing
- blog publishing
- local SEO context
- one shared Master Content system
- one campaign timeline
- a small-business-first interface

The product should not compete by having the largest feature list.

It should compete by making a useful small-business marketing workflow unusually easy to understand and operate.

---

## Product Principle

The durable value is not simply that AI makes the code faster to build.

The more defensible value is:

- understanding the actual small-business workflow
- connecting tools that normally live in separate products
- reducing setup friction
- making the data reusable across channels
- making campaigns easier to execute
- turning complicated APIs into understandable actions

The application should hide infrastructure complexity whenever it safely can.

---

## Relationship to the Current Content Social Hub

The existing Content Social Hub should continue being built as its own coherent product.

It is also a useful proving ground for the larger GIGNovate platform.

Near-term work should not be derailed by prematurely merging the CRM, direct mail, email, social, and website systems.

Instead:

1. Complete and validate the social/content workflow.
2. Keep the data model flexible enough to support a future workspace model.
3. Document integration points.
4. Continue using the existing CRM as a second working proof of concept.
5. Define the shared objects before attempting a major merge.
6. Build the larger GIGNovate platform only when the workflows are understood well enough to justify consolidation.

---

## Possible Future Product Statement

> **GIGNovate is a small-business marketing and relationship hub that connects customers, email, direct mail, social media, website content, and local campaigns in one workspace.**

A shorter version:

> **One place to manage the people you serve and the marketing that reaches them.**

---

## Status

This document is a product-direction note, not an implementation commitment.

The existing `README.md` remains the implementation source of truth for Content Social Hub. This file should evolve as the larger GIGNovate concept becomes clearer.