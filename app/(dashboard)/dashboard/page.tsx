import Link from "next/link"
import { format } from "date-fns"

import { QuickSend } from "@/app/(dashboard)/dashboard/quick-send"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDashboardStats, getMailingListsWithCounts, getOrganisationAndContacts, getQuickSendTemplates } from "@/lib/data"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const [stats, orgAndContacts, templates, mailingLists] = await Promise.all([
    getDashboardStats(),
    getOrganisationAndContacts(),
    getQuickSendTemplates(),
    getMailingListsWithCounts(),
  ])
  const supabase = await createClient()
  const listIds = mailingLists.map((list) => list.id)
  const { data: listLinks } =
    listIds.length > 0
      ? await supabase.from("mailing_list_contacts").select("list_id, contact_id").in("list_id", listIds)
      : { data: [] as Array<{ list_id: string; contact_id: string }> }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Track your charity outreach and jump into your next campaign.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total Contacts</CardDescription>
            <CardTitle>{stats.contactsCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total Campaigns</CardDescription>
            <CardTitle>{stats.campaignsCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Last Campaign Sent</CardDescription>
            <CardTitle className="text-base">
              {stats.lastSentAt ? format(new Date(stats.lastSentAt), "PPP p") : "No campaign sent yet"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Keep donor and volunteer communication moving.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/contacts">Import Contacts</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/campaigns/new">Create Campaign</Link>
          </Button>
        </CardContent>
      </Card>

      <QuickSend
        templates={templates}
        contacts={orgAndContacts.contacts.map((contact) => ({
          id: contact.id,
          email: contact.email,
          name: contact.name,
        }))}
        mailingLists={mailingLists.map((list) => ({ id: list.id, name: list.name }))}
        listLinks={listLinks ?? []}
      />
    </div>
  )
}
