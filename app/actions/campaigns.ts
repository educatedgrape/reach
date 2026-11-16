"use server"

import { revalidatePath } from "next/cache"
import { Resend } from "resend"

import { createCampaignRecord } from "@/lib/data"
import { env } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import { requireOrganisation, requireUser } from "@/lib/auth"

const resend = new Resend(env.resendApiKey)

async function createTemplateIfRequested(input: {
  orgId: string
  shouldCreateTemplate?: boolean
  templateName?: string
  title: string
  subject: string
  bodyHtml: string
}) {
  if (!input.shouldCreateTemplate) return { created: false as const }
  const supabase = await createClient()
  const name = (input.templateName || input.title).trim()
  if (!name) return { created: false as const }
  const { error } = await supabase.from("quick_send_templates").insert({
    org_id: input.orgId,
    name,
    subject: input.subject,
    body_html: input.bodyHtml,
  })
  if (error) {
    return { created: false as const, error: error.message }
  }
  return { created: true as const }
}

export async function saveDraftCampaign(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim()
  const subject = String(formData.get("subject") ?? "").trim()
  const bodyHtml = String(formData.get("bodyHtml") ?? "").trim()
  const shouldCreateTemplate = String(formData.get("saveAsTemplate") ?? "") === "true"
  const templateName = String(formData.get("templateName") ?? "").trim()

  if (!title || !subject || !bodyHtml) {
    return { error: "Title, subject, and body are required to save a draft." }
  }

  try {
    const { orgId } = await createCampaignRecord({
      title,
      subject,
      bodyHtml,
      status: "draft",
      scheduledAt: null,
    })
    const templateResult = await createTemplateIfRequested({
      orgId,
      shouldCreateTemplate,
      templateName,
      title,
      subject,
      bodyHtml,
    })
    if (templateResult.error) return { error: templateResult.error }
    revalidatePath("/campaigns")
    revalidatePath("/dashboard")
    return { success: shouldCreateTemplate ? "Campaign saved and template created" : "Draft saved." }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save draft." }
  }
}

export async function sendCampaign(input: {
  title: string
  subject: string
  bodyHtml: string
  contactIds: string[]
  scheduledAt?: string | null
  saveAsTemplate?: boolean
  templateName?: string
}) {
  if (!input.title || !input.subject || !input.bodyHtml) {
    return { error: "Campaign title, subject, and body are required." }
  }

  if (!input.contactIds.length) {
    return { error: "Select at least one contact." }
  }

  const supabase = await createClient()
  const status = "sending"

  try {
    const { campaignId, orgId } = await createCampaignRecord({
      title: input.title,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      status,
      scheduledAt: input.scheduledAt ?? null,
    })
    const templateResult = await createTemplateIfRequested({
      orgId,
      shouldCreateTemplate: input.saveAsTemplate,
      templateName: input.templateName,
      title: input.title,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
    })
    if (templateResult.error) return { error: templateResult.error }

    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("id, email, name")
      .eq("org_id", orgId)
      .in("id", input.contactIds)

    if (contactsError || !contacts?.length) {
      throw new Error(contactsError?.message ?? "No contacts found for this campaign.")
    }

    let sentCount = 0
    const sendRecords: Array<{
      campaign_id: string
      contact_id: string
      resend_email_id: string | null
      status: string
      sent_at: string | null
    }> = []

    for (const contact of contacts) {
      const personalizedBody = input.bodyHtml.replaceAll("{{name}}", contact.name || "friend")
      const emailResult = await resend.emails.send({
        from: "OutreachHQ <onboarding@resend.dev>",
        to: [contact.email],
        subject: input.subject,
        html: personalizedBody,
        scheduledAt: input.scheduledAt ?? undefined,
      })

      if (emailResult.error) {
        sendRecords.push({
          campaign_id: campaignId,
          contact_id: contact.id,
          resend_email_id: null,
          status: "failed",
          sent_at: null,
        })
        continue
      }

      sentCount += 1
      sendRecords.push({
        campaign_id: campaignId,
        contact_id: contact.id,
        resend_email_id: emailResult.data?.id ?? null,
        status: input.scheduledAt ? "scheduled" : "sent",
        sent_at: input.scheduledAt ? null : new Date().toISOString(),
      })
    }

    if (sendRecords.length) {
      const { error: sendInsertError } = await supabase.from("sends").insert(sendRecords)
      if (sendInsertError) {
        throw new Error(sendInsertError.message)
      }
    }

    const finalStatus = "sent"
    await supabase
      .from("campaigns")
      .update({
        status: finalStatus,
        sent_at: input.scheduledAt ? null : new Date().toISOString(),
      })
      .eq("id", campaignId)

    revalidatePath("/campaigns")
    revalidatePath("/dashboard")

    if (input.scheduledAt) {
      return {
        success: input.saveAsTemplate
          ? "Campaign sent and template created"
          : `Campaign scheduled for ${contacts.length} contact(s).`,
        sentCount: contacts.length,
      }
    }

    return {
      success: input.saveAsTemplate ? "Campaign sent and template created" : `Campaign sent to ${sentCount} contact(s).`,
      sentCount,
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to send campaign." }
  }
}

export async function deleteCampaign(campaignId: string) {
  if (!campaignId) {
    return { error: "Campaign id is required." }
  }

  try {
    const user = await requireUser()
    const org = await requireOrganisation(user.id)
    const supabase = await createClient()
    const { error } = await supabase.from("campaigns").delete().eq("id", campaignId).eq("org_id", org.id)
    if (error) {
      return { error: error.message }
    }
    revalidatePath("/campaigns")
    revalidatePath("/dashboard")
    return { success: "Campaign deleted" }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete campaign." }
  }
}
