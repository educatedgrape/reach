"use server"

import { format } from "date-fns"
import { revalidatePath } from "next/cache"

import { sendCampaign } from "@/app/actions/campaigns"
import { requireOrganisation, requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

type TemplateInput = {
  name: string
  subject: string
  bodyHtml: string
  listIds?: string[]
}

async function resolveContext() {
  const user = await requireUser()
  const org = await requireOrganisation(user.id)
  const supabase = await createClient()
  return { org, supabase }
}

export async function createQuickSendTemplate(input: TemplateInput) {
  const { org, supabase } = await resolveContext()
  const name = input.name.trim()
  const subject = input.subject.trim()
  const bodyHtml = input.bodyHtml.trim()
  if (!name || !subject || !bodyHtml) return { error: "Name, subject, and body are required." }

  const { data, error } = await supabase
    .from("quick_send_templates")
    .insert({ org_id: org.id, name, subject, body_html: bodyHtml })
    .select("id, org_id, name, subject, body_html, created_at, updated_at")
    .single()

  if (error || !data) return { error: error?.message ?? "Unable to save template." }
  const listIds = [...new Set((input.listIds ?? []).filter(Boolean))]
  if (listIds.length) {
    const { error: linkError } = await supabase.from("quick_send_template_lists").insert(
      listIds.map((listId) => ({
        template_id: data.id,
        list_id: listId,
      }))
    )
    if (linkError) return { error: linkError.message }
  }
  revalidatePath("/dashboard")
  return { success: "Template saved.", template: { ...data, default_list_ids: listIds } }
}

export async function updateQuickSendTemplate(templateId: string, input: TemplateInput) {
  const { org, supabase } = await resolveContext()
  const name = input.name.trim()
  const subject = input.subject.trim()
  const bodyHtml = input.bodyHtml.trim()
  if (!templateId || !name || !subject || !bodyHtml) return { error: "Template id, name, subject, and body are required." }

  const { data, error } = await supabase
    .from("quick_send_templates")
    .update({ name, subject, body_html: bodyHtml, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("org_id", org.id)
    .select("id, org_id, name, subject, body_html, created_at, updated_at")
    .single()

  if (error || !data) return { error: error?.message ?? "Unable to update template." }

  const listIds = [...new Set((input.listIds ?? []).filter(Boolean))]
  const { error: deleteLinksError } = await supabase.from("quick_send_template_lists").delete().eq("template_id", templateId)
  if (deleteLinksError) return { error: deleteLinksError.message }
  if (listIds.length) {
    const { error: linkError } = await supabase.from("quick_send_template_lists").insert(
      listIds.map((listId) => ({
        template_id: templateId,
        list_id: listId,
      }))
    )
    if (linkError) return { error: linkError.message }
  }
  revalidatePath("/dashboard")
  return { success: "Template updated.", template: { ...data, default_list_ids: listIds } }
}

export async function deleteQuickSendTemplate(templateId: string) {
  const { org, supabase } = await resolveContext()
  if (!templateId) return { error: "Template id is required." }
  const { error } = await supabase.from("quick_send_templates").delete().eq("id", templateId).eq("org_id", org.id)
  if (error) return { error: error.message }
  revalidatePath("/dashboard")
  return { success: "Template deleted." }
}

export async function sendQuickSendTemplate(input: {
  templateId: string
  subject: string
  bodyHtml: string
  contactIds: string[]
}) {
  const { org, supabase } = await resolveContext()
  const { data: template, error } = await supabase
    .from("quick_send_templates")
    .select("id, name")
    .eq("id", input.templateId)
    .eq("org_id", org.id)
    .single()
  if (error || !template) return { error: error?.message ?? "Template not found." }

  const result = await sendCampaign({
    title: `${template.name} — ${format(new Date(), "PPP")}`,
    subject: input.subject.trim(),
    bodyHtml: input.bodyHtml.trim(),
    contactIds: input.contactIds,
  })
  if (result.error) return { error: result.error }
  return { success: `${result.sentCount ?? 0} emails sent.`, sentCount: result.sentCount ?? 0 }
}
