# OutreachHQ

**A lightweight email outreach platform for charities: import supporters, send campaigns, and see who opened and clicked.**

Live demo: [reach-two-theta.vercel.app](https://reach-two-theta.vercel.app)

## Features

- **Contacts:** import supporters from CSV, tag them, and organise them into mailing lists.
- **Campaigns:** write a campaign, pick a list and send it through Resend. Each send is tracked per recipient.
- **Engagement tracking:** a signed Resend webhook records opens, clicks, bounces and complaints, and turns them into open, click and bounce rates for each campaign.
- **Dashboard:** an overview of your outreach and a quick-send panel to start the next campaign. The campaigns page charts each campaign's performance.
- **Quick send:** reusable templates with default mailing lists, for one-click sends of recurring messages.
- **Automations:** schedule a template to a list daily, weekly, monthly or on a custom interval. Scheduling and management are built; the background job that runs scheduled sends is not wired up yet.
- **Sign-in:** magic link or Google, through Supabase Auth. Each user's data is scoped to their own organisation.

## Tech stack

| Area | Tools |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, Radix, Phosphor Icons, Recharts |
| Database and auth | Supabase (Postgres and Auth) |
| Email | Resend, with Svix-signed webhooks |
| Hosting | Vercel |

## Getting started

You need Node.js 20+, a Supabase project and a Resend account.

```bash
git clone https://github.com/educatedgrape/reach.git
cd reach
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (server-only, never expose it) |
| `RESEND_API_KEY` | Resend → API Keys |
| `RESEND_WEBHOOK_SECRET` | Resend → Webhooks, after adding an endpoint |

### Webhook

To track engagement, add a Resend webhook pointing to `https://<your-domain>/api/webhooks/resend` and subscribe to the opened, clicked, bounced and complained events.

### Database

The app uses these Supabase tables: `organisations`, `contacts`, `mailing_lists`, `mailing_list_contacts`, `campaigns`, `sends`, `events`, `quick_send_templates`, `quick_send_template_lists`, `automated_campaigns` and `automated_campaign_runs`. Their shapes are defined in [`lib/types.ts`](lib/types.ts).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run format` | Prettier |

## Project structure

```
app/
  (dashboard)/    dashboard, contacts, campaigns and automate pages
  actions/        server actions for auth, contacts, campaigns, templates, automations
  api/webhooks/   Resend webhook handler
  auth/           OAuth callback
  login/          sign-in page
components/       app shell and shadcn/ui components
lib/              Supabase clients, data access, env loading, types
middleware.ts     session refresh and route protection
```
