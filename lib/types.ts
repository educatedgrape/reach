export type CampaignStatus = "draft" | "sending" | "sent"

export type DbOrganisation = {
  id: string
  owner_id: string
  name: string
  created_at: string
}

export type DbContact = {
  id: string
  org_id: string
  email: string
  name: string | null
  tags: string | null
  imported_at: string
}

export type DbCampaign = {
  id: string
  org_id: string
  title: string
  subject: string
  body_html: string
  status: CampaignStatus
  scheduled_at: string | null
  sent_at: string | null
  created_at: string
}

export type CampaignMetrics = {
  totalRecipients: number
  totalSent: number
  opened: number
  clicked: number
  bounced: number
  openedPct: number
  clickedPct: number
  bouncedPct: number
}

export type DbCampaignWithMetrics = DbCampaign & {
  metrics: CampaignMetrics
}

export type MailingList = {
  id: string
  org_id: string
  name: string
  created_at: string
}

export type QuickSendTemplate = {
  id: string
  org_id: string
  name: string
  subject: string
  body_html: string
  created_at: string
  updated_at: string
  default_list_ids?: string[]
}

export type AutomationFrequency = "daily" | "weekly" | "monthly" | "custom"
export type AutomationStatus = "active" | "paused" | "completed"

export type AutomatedCampaign = {
  id: string
  org_id: string
  name: string
  template_id: string | null
  mailing_list_id: string | null
  frequency: AutomationFrequency
  custom_interval_days: number | null
  send_time: string
  start_date: string
  end_date: string | null
  status: AutomationStatus
  next_run_at: string | null
  last_run_at: string | null
  created_at: string
}

export type AutomatedCampaignRun = {
  id: string
  automated_campaign_id: string
  ran_at: string
  recipients_count: number | null
  status: "completed" | "failed" | null
}
