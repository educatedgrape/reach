"use server"

import { addDays, addMonths, set, startOfDay } from "date-fns"
import { revalidatePath } from "next/cache"

import { requireOrganisation, requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { AutomationFrequency } from "@/lib/types"

type AutomationInput = {
  name: string
  templateId: string | null
  mailingListId: string | null
  frequency: AutomationFrequency
  customIntervalDays: number | null
  sendTime: string
  startDate: string
  endDate: string | null
}

async function resolveContext() {
  const user = await requireUser()
  const org = await requireOrganisation(user.id)
  const supabase = await createClient()
  return { org, supabase }
}

function parseSendTime(sendTime: string) {
  const [hours, minutes] = sendTime.split(":").map((value) => Number(value))
  return { hours: Number.isNaN(hours) ? 9 : hours, minutes: Number.isNaN(minutes) ? 0 : minutes }
}

function getNextFromBase(base: Date, frequency: AutomationFrequency, customIntervalDays: number | null) {
  if (frequency === "daily") return addDays(base, 1)
  if (frequency === "weekly") return addDays(base, 7)
  if (frequency === "monthly") return addMonths(base, 1)
  return addDays(base, Math.max(customIntervalDays ?? 1, 1))
}

function computeNextRunAtForCreate(input: AutomationInput) {
  const start = startOfDay(new Date(input.startDate))
  const { hours, minutes } = parseSendTime(input.sendTime)
  let next = set(start, { hours, minutes, seconds: 0, milliseconds: 0 })
  const now = new Date()
  while (next <= now) {
    next = getNextFromBase(next, input.frequency, input.customIntervalDays)
  }
  return next.toISOString()
}

function computeNextRunAtForResume(existing: {
  frequency: AutomationFrequency
  custom_interval_days: number | null
  send_time: string
}) {
  const { hours, minutes } = parseSendTime(existing.send_time)
  let next = set(new Date(), { hours, minutes, seconds: 0, milliseconds: 0 })
  while (next <= new Date()) {
    next = getNextFromBase(next, existing.frequency, existing.custom_interval_days)
  }
  return next.toISOString()
}

export async function createAutomation(input: AutomationInput) {
  const { org, supabase } = await resolveContext()
  const nextRunAt = computeNextRunAtForCreate(input)
  const payload = {
    org_id: org.id,
    name: input.name.trim(),
    template_id: input.templateId,
    mailing_list_id: input.mailingListId,
    frequency: input.frequency,
    custom_interval_days: input.frequency === "custom" ? Math.max(input.customIntervalDays ?? 1, 1) : null,
    send_time: input.sendTime,
    start_date: input.startDate,
    end_date: input.endDate,
    next_run_at: nextRunAt,
  }
  const { error } = await supabase.from("automated_campaigns").insert(payload)
  if (error) return { error: error.message }
  revalidatePath("/automate")
  return { success: `Automation created. First send scheduled for ${new Date(nextRunAt).toLocaleString()}.` }
}

export async function updateAutomation(automationId: string, input: AutomationInput) {
  const { org, supabase } = await resolveContext()
  const nextRunAt = computeNextRunAtForCreate(input)
  const { error } = await supabase
    .from("automated_campaigns")
    .update({
      name: input.name.trim(),
      template_id: input.templateId,
      mailing_list_id: input.mailingListId,
      frequency: input.frequency,
      custom_interval_days: input.frequency === "custom" ? Math.max(input.customIntervalDays ?? 1, 1) : null,
      send_time: input.sendTime,
      start_date: input.startDate,
      end_date: input.endDate,
      next_run_at: nextRunAt,
    })
    .eq("id", automationId)
    .eq("org_id", org.id)
  if (error) return { error: error.message }
  revalidatePath("/automate")
  return { success: "Automation updated." }
}

export async function toggleAutomationStatus(automationId: string) {
  const { org, supabase } = await resolveContext()
  const { data: automation, error } = await supabase
    .from("automated_campaigns")
    .select("id, status, frequency, custom_interval_days, send_time")
    .eq("id", automationId)
    .eq("org_id", org.id)
    .single()
  if (error || !automation) return { error: error?.message ?? "Automation not found." }

  if (automation.status === "active") {
    const { error: pauseError } = await supabase.from("automated_campaigns").update({ status: "paused" }).eq("id", automationId)
    if (pauseError) return { error: pauseError.message }
    revalidatePath("/automate")
    return { success: "Automation paused." }
  }

  const nextRunAt = computeNextRunAtForResume(automation)
  const { error: resumeError } = await supabase
    .from("automated_campaigns")
    .update({ status: "active", next_run_at: nextRunAt })
    .eq("id", automationId)
  if (resumeError) return { error: resumeError.message }
  revalidatePath("/automate")
  return { success: "Automation resumed." }
}

export async function deleteAutomation(automationId: string) {
  const { org, supabase } = await resolveContext()
  const { error } = await supabase.from("automated_campaigns").delete().eq("id", automationId).eq("org_id", org.id)
  if (error) return { error: error.message }
  revalidatePath("/automate")
  return { success: "Automation deleted." }
}
