"use server"

import { revalidatePath } from "next/cache"

import { requireOrganisation, requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

type ImportRow = {
  email: string
  name?: string
  tags?: string[]
}

async function resolveOrgAndClient() {
  const user = await requireUser()
  const org = await requireOrganisation(user.id)
  const supabase = await createClient()
  return { org, supabase }
}

export async function importContacts(rows: ImportRow[]) {
  if (!rows.length) {
    return { error: "No contacts were selected for import." }
  }

  const { org, supabase } = await resolveOrgAndClient()

  const normalized = rows
    .map((row) => ({
      email: row.email.trim().toLowerCase(),
      name: row.name?.trim() || null,
      tags: row.tags?.filter(Boolean).join(", ") || null,
    }))
    .filter((row) => row.email)

  if (!normalized.length) {
    return { error: "Every row is missing a valid email." }
  }

  const uniqueByEmail = [...new Map(normalized.map((row) => [row.email, row])).values()]
  const emails = uniqueByEmail.map((row) => row.email)

  const { data: existingContacts, error: existingError } = await supabase
    .from("contacts")
    .select("email")
    .eq("org_id", org.id)
    .in("email", emails)

  if (existingError) {
    return { error: existingError.message }
  }

  const existingEmails = new Set((existingContacts ?? []).map((row) => row.email.toLowerCase()))
  const toInsert = uniqueByEmail.filter((row) => !existingEmails.has(row.email))

  if (!toInsert.length) {
    return { success: "All selected contacts were already in your list.", imported: 0 }
  }

  const payload = toInsert.map((row) => ({
    org_id: org.id,
    email: row.email,
    name: row.name,
    tags: row.tags,
  }))

  const { error } = await supabase.from("contacts").insert(payload)
  if (error) {
    return { error: error.message }
  }

  revalidatePath("/contacts")
  revalidatePath("/dashboard")
  return { success: `Imported ${toInsert.length} contact(s).`, imported: toInsert.length }
}

export async function createMailingList(name: string) {
  const trimmedName = name.trim()
  if (!trimmedName) return { error: "List name is required." }
  const { org, supabase } = await resolveOrgAndClient()

  const { data, error } = await supabase
    .from("mailing_lists")
    .insert({ org_id: org.id, name: trimmedName })
    .select("id, name")
    .single()

  if (error || !data) return { error: error?.message ?? "Unable to create list." }

  revalidatePath("/contacts")
  revalidatePath("/campaigns/new")
  return { success: `List '${data.name}' created.`, listId: data.id, listName: data.name }
}

export async function deleteMailingList(listId: string) {
  if (!listId) return { error: "List id is required." }
  const { org, supabase } = await resolveOrgAndClient()
  const { error } = await supabase.from("mailing_lists").delete().eq("id", listId).eq("org_id", org.id)
  if (error) return { error: error.message }
  revalidatePath("/contacts")
  revalidatePath("/campaigns/new")
  return { success: "List deleted." }
}

export async function addContactsToList(input: { listId: string; contactIds: string[] }) {
  if (!input.listId || !input.contactIds.length) {
    return { error: "List and contacts are required." }
  }
  const { org, supabase } = await resolveOrgAndClient()

  const { data: list, error: listError } = await supabase
    .from("mailing_lists")
    .select("id, name")
    .eq("id", input.listId)
    .eq("org_id", org.id)
    .single()
  if (listError || !list) return { error: listError?.message ?? "List not found." }

  const { data: contacts, error: contactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("org_id", org.id)
    .in("id", input.contactIds)
  if (contactError) return { error: contactError.message }

  const payload = (contacts ?? []).map((contact) => ({
    list_id: input.listId,
    contact_id: contact.id,
  }))
  if (!payload.length) return { error: "No valid contacts selected." }

  const { error } = await supabase.from("mailing_list_contacts").upsert(payload, { onConflict: "list_id,contact_id" })
  if (error) return { error: error.message }

  revalidatePath("/contacts")
  revalidatePath("/campaigns/new")
  return { success: `Added ${payload.length} contact(s) to ${list.name}.`, added: payload.length, listName: list.name }
}
