import { Webhook } from "svix"

import { env } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"

type SupportedEventType = "opened" | "clicked" | "bounced" | "complained"

type VerifiedResendEvent = {
  type?: string
  data?: {
    email_id?: string
    created_at?: string
    click?: { url?: string }
    url?: string
  }
  created_at?: string
}

function mapEventType(rawType: string | undefined): SupportedEventType | null {
  if (!rawType) return null
  if (rawType.endsWith("opened")) return "opened"
  if (rawType.endsWith("clicked")) return "clicked"
  if (rawType.endsWith("bounced")) return "bounced"
  if (rawType.endsWith("complained")) return "complained"
  return null
}

export async function POST(request: Request) {
  const payload = await request.text()
  const svixId = request.headers.get("svix-id")
  const svixTimestamp = request.headers.get("svix-timestamp")
  const svixSignature = request.headers.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing webhook signature headers", { status: 400 })
  }

  const webhook = new Webhook(env.resendWebhookSecret)
  let event: VerifiedResendEvent

  try {
    event = webhook.verify(payload, {
      "svix-id": svixId,
      "svix-signature": svixSignature,
      "svix-timestamp": svixTimestamp,
    }) as VerifiedResendEvent
  } catch {
    return new Response("Invalid signature", { status: 401 })
  }

  const eventType = mapEventType(event.type)
  if (!eventType) {
    return new Response("Ignored event type", { status: 200 })
  }

  const resendEmailId = event.data?.email_id
  if (!resendEmailId) {
    return new Response("Missing email_id", { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: send, error: sendError } = await supabase
    .from("sends")
    .select("id, campaign_id")
    .eq("resend_email_id", resendEmailId)
    .maybeSingle()

  if (sendError) {
    return new Response(sendError.message, { status: 500 })
  }

  if (!send) {
    return new Response("Send record not found", { status: 200 })
  }

  const clickUrl = event.data?.click?.url ?? event.data?.url ?? null
  const occurredAt = event.data?.created_at ?? event.created_at ?? new Date().toISOString()

  const { error: insertError } = await supabase.from("events").insert({
    send_id: send.id,
    campaign_id: send.campaign_id,
    event_type: eventType,
    url: eventType === "clicked" ? clickUrl : null,
    occurred_at: occurredAt,
  })

  if (insertError) {
    return new Response(insertError.message, { status: 500 })
  }

  return new Response("ok", { status: 200 })
}
