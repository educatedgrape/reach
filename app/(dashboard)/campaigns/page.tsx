import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CampaignsTable } from "@/app/(dashboard)/campaigns/campaigns-table"
import { getCampaigns } from "@/lib/data"

export default async function CampaignsPage() {
  const campaigns = await getCampaigns()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Campaigns</h2>
          <p className="text-sm text-muted-foreground">Plan and review outreach sent to your supporters.</p>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">New Campaign</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign History</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <CampaignsTable initialCampaigns={campaigns} />
        </CardContent>
      </Card>
    </div>
  )
}
