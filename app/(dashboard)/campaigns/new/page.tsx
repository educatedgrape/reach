import { CampaignForm } from "@/app/(dashboard)/campaigns/new/campaign-form"
import { requireOrganisation, requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export default async function NewCampaignPage() {
  const user = await requireUser()
  const org = await requireOrganisation(user.id)
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, email, name")
    .eq("org_id", org.id)
    .order("name", { ascending: true })

  const { data: mailingLists } = await supabase.from("mailing_lists").select("id, name").eq("org_id", org.id).order("name")
  const listIds = (mailingLists ?? []).map((list) => list.id)
  const { data: listLinks } =
    listIds.length > 0
      ? await supabase.from("mailing_list_contacts").select("list_id, contact_id").in("list_id", listIds)
      : { data: [] as Array<{ list_id: string; contact_id: string }> }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">New Campaign</h2>
        <p className="text-sm text-muted-foreground">Prepare and send meaningful updates to your supporters.</p>
      </div>
      <CampaignForm contacts={contacts ?? []} mailingLists={mailingLists ?? []} listLinks={listLinks ?? []} />
    </div>
  )
}
