import { redirect } from "next/navigation"

import type { DbOrganisation } from "@/lib/types"
import { createClient } from "@/lib/supabase/server"

export async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return user
}

export async function requireOrganisation(userId?: string): Promise<DbOrganisation> {
  const user = userId ? { id: userId } : await requireUser()
  const supabase = await createClient()

  const { data: org, error } = await supabase
    .from("organisations")
    .select("id, owner_id, name, created_at")
    .eq("owner_id", user.id)
    .single()

  if (error || !org) {
    throw new Error("Unable to load your organisation")
  }

  return org
}
