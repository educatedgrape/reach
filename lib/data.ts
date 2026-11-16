import { formatISO } from "date-fns"

import { requireOrganisation, requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type {
  AutomatedCampaign,
  AutomatedCampaignRun,
  DbCampaign,
  DbCampaignWithMetrics,
  DbContact,
  MailingList,
  QuickSendTemplate,
} from "@/lib/types"

export async function getDashboardStats() {
  const user = await requireUser()
  const org = await requireOrganisation(user.id)
  const supabase = await createClient()

  const [{ count: contactsCount }, { count: campaignsCount }, { data: lastSentCampaign }] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("org_id", org.id),
    supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("org_id", org.id),
    supabase
      .from("campaigns")
      .select("sent_at")
      .eq("org_id", org.id)
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    contactsCount: contactsCount ?? 0,
    campaignsCount: campaignsCount ?? 0,
    lastSentAt: lastSentCampaign?.sent_at ?? null,
  }
}

export async function getContacts() {
  const user = await requireUser()
  const org = await requireOrganisation(user.id)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("contacts")
    .select("id, org_id, email, name, tags, imported_at")
    .eq("org_id", org.id)
    .order("imported_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as DbContact[]
}

export async function getOrganisationAndContacts() {
  const user = await requireUser()
  const org = await requireOrganisation(user.id)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("contacts")
    .select("id, org_id, email, name, tags, imported_at")
    .eq("org_id", org.id)
    .order("name", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return {
    organisation: org,
    contacts: (data ?? []) as DbContact[],
  }
}

export async function getQuickSendTemplates() {
  const user = await requireUser()
  const org = await requireOrganisation(user.id)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("quick_send_templates")
    .select("id, org_id, name, subject, body_html, created_at, updated_at")
    .eq("org_id", org.id)
    .order("updated_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const templates = (data ?? []) as QuickSendTemplate[]
  if (!templates.length) return templates

  const templateIds = templates.map((template) => template.id)
  const { data: links, error: linkError } = await supabase
    .from("quick_send_template_lists")
    .select("template_id, list_id")
    .in("template_id", templateIds)

  if (linkError) {
    throw new Error(linkError.message)
  }

  const listIdsByTemplate = new Map<string, string[]>()
  for (const link of links ?? []) {
    const ids = listIdsByTemplate.get(link.template_id) ?? []
    ids.push(link.list_id)
    listIdsByTemplate.set(link.template_id, ids)
  }

  return templates.map((template) => ({
    ...template,
    default_list_ids: listIdsByTemplate.get(template.id) ?? [],
  }))
}

export async function getMailingListsWithCounts() {
  const user = await requireUser()
  const org = await requireOrganisation(user.id)
  const supabase = await createClient()

  const { data: lists, error: listError } = await supabase
    .from("mailing_lists")
    .select("id, org_id, name, created_at")
    .eq("org_id", org.id)
    .order("name", { ascending: true })

  if (listError) {
    throw new Error(listError.message)
  }

  const listIds = (lists ?? []).map((list) => list.id)
  if (!listIds.length) {
    return [] as Array<MailingList & { contactCount: number }>
  }

  const { data: links, error: linkError } = await supabase
    .from("mailing_list_contacts")
    .select("list_id")
    .in("list_id", listIds)

  if (linkError) {
    throw new Error(linkError.message)
  }

  const counts = new Map<string, number>()
  for (const link of links ?? []) {
    counts.set(link.list_id, (counts.get(link.list_id) ?? 0) + 1)
  }

  return (lists ?? []).map((list) => ({
    ...list,
    contactCount: counts.get(list.id) ?? 0,
  }))
}

export async function getContactsPageData() {
  const [contacts, mailingLists] = await Promise.all([getContacts(), getMailingListsWithCounts()])
  const user = await requireUser()
  const org = await requireOrganisation(user.id)
  const supabase = await createClient()

  const listIds = mailingLists.map((list) => list.id)
  if (!listIds.length) {
    return { contacts, mailingLists, listLinks: [] as Array<{ list_id: string; contact_id: string }>, orgId: org.id }
  }

  const { data: listLinks, error } = await supabase
    .from("mailing_list_contacts")
    .select("list_id, contact_id")
    .in("list_id", listIds)

  if (error) {
    throw new Error(error.message)
  }

  return {
    contacts,
    mailingLists,
    listLinks: (listLinks ?? []) as Array<{ list_id: string; contact_id: string }>,
    orgId: org.id,
  }
}

export function formatFrequencyLabel(input: {
  frequency: "daily" | "weekly" | "monthly" | "custom"
  custom_interval_days: number | null
}) {
  if (input.frequency === "daily") return "Daily"
  if (input.frequency === "weekly") return "Weekly"
  if (input.frequency === "monthly") return "Monthly"
  return `Every ${Math.max(input.custom_interval_days ?? 1, 1)} days`
}

export async function getAutomatePageData() {
  const user = await requireUser()
  const org = await requireOrganisation(user.id)
  const supabase = await createClient()

  const [{ data: automations, error: automationError }, { data: runs, error: runsError }, templates, mailingLists] =
    await Promise.all([
      supabase
        .from("automated_campaigns")
        .select(
          "id, org_id, name, template_id, mailing_list_id, frequency, custom_interval_days, send_time, start_date, end_date, status, next_run_at, last_run_at, created_at"
        )
        .eq("org_id", org.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("automated_campaign_runs")
        .select("id, automated_campaign_id, ran_at, recipients_count, status, automated_campaigns(name)")
        .order("ran_at", { ascending: false })
        .limit(20),
      getQuickSendTemplates(),
      getMailingListsWithCounts(),
    ])

  if (automationError) throw new Error(automationError.message)
  if (runsError) throw new Error(runsError.message)

  const automationList = (automations ?? []) as AutomatedCampaign[]
  const runList = (runs ?? []).map((run) => {
    const relation = Array.isArray(run.automated_campaigns) ? run.automated_campaigns[0] : run.automated_campaigns
    return {
      ...(run as AutomatedCampaignRun),
      automated_campaigns: relation ? { name: relation.name } : null,
    }
  }) as Array<AutomatedCampaignRun & { automated_campaigns?: { name: string } | null }>

  return {
    automations: automationList,
    runs: runList,
    templates,
    mailingLists,
  }
}

export async function getCampaigns() {
  const user = await requireUser()
  const org = await requireOrganisation(user.id)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("campaigns")
    .select("id, org_id, title, subject, body_html, status, scheduled_at, sent_at, created_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const campaigns = (data ?? []) as DbCampaign[]
  if (!campaigns.length) {
    return [] as DbCampaignWithMetrics[]
  }

  const campaignIds = campaigns.map((campaign) => campaign.id)
  const [{ data: sends, error: sendsError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from("sends").select("campaign_id, id, status").in("campaign_id", campaignIds),
    supabase.from("events").select("campaign_id, send_id, event_type").in("campaign_id", campaignIds),
  ])

  if (sendsError) {
    throw new Error(sendsError.message)
  }

  if (eventsError) {
    throw new Error(eventsError.message)
  }

  const sendsByCampaign = new Map<string, { totalSent: number }>()
  const recipientsByCampaign = new Map<string, number>()
  for (const send of sends ?? []) {
    recipientsByCampaign.set(send.campaign_id, (recipientsByCampaign.get(send.campaign_id) ?? 0) + 1)
    const current = sendsByCampaign.get(send.campaign_id) ?? { totalSent: 0 }
    if (send.status === "sent" || send.status === "scheduled") {
      current.totalSent += 1
    }
    sendsByCampaign.set(send.campaign_id, current)
  }

  const eventSetsByCampaign = new Map<
    string,
    { opened: Set<string>; clicked: Set<string>; bounced: Set<string> }
  >()
  for (const event of events ?? []) {
    const current = eventSetsByCampaign.get(event.campaign_id) ?? {
      opened: new Set<string>(),
      clicked: new Set<string>(),
      bounced: new Set<string>(),
    }
    if (event.event_type === "opened") current.opened.add(event.send_id)
    if (event.event_type === "clicked") current.clicked.add(event.send_id)
    if (event.event_type === "bounced" || event.event_type === "complained") current.bounced.add(event.send_id)
    eventSetsByCampaign.set(event.campaign_id, current)
  }

  return campaigns.map((campaign) => {
    const sendStats = sendsByCampaign.get(campaign.id) ?? { totalSent: 0 }
    const eventStats = eventSetsByCampaign.get(campaign.id) ?? {
      opened: new Set<string>(),
      clicked: new Set<string>(),
      bounced: new Set<string>(),
    }
    const totalSent = sendStats.totalSent
    const opened = eventStats.opened.size
    const clicked = eventStats.clicked.size
    const bounced = eventStats.bounced.size
    const percent = (value: number) => (totalSent ? Math.round((value / totalSent) * 100) : 0)

    return {
      ...campaign,
      metrics: {
        totalRecipients: recipientsByCampaign.get(campaign.id) ?? 0,
        totalSent,
        opened,
        clicked,
        bounced,
        openedPct: percent(opened),
        clickedPct: percent(clicked),
        bouncedPct: percent(bounced),
      },
    }
  })
}

export async function createCampaignRecord(input: {
  title: string
  subject: string
  bodyHtml: string
  status: "draft" | "sending" | "sent"
  scheduledAt?: string | null
}) {
  const user = await requireUser()
  const org = await requireOrganisation(user.id)
  const supabase = await createClient()

  const payload = {
    org_id: org.id,
    title: input.title,
    subject: input.subject,
    body_html: input.bodyHtml,
    status: input.status,
    scheduled_at: input.scheduledAt ?? null,
    sent_at: input.status === "sent" ? formatISO(new Date()) : null,
  }

  const { data, error } = await supabase.from("campaigns").insert(payload).select("id").single()

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create campaign")
  }

  return { campaignId: data.id, orgId: org.id }
}
