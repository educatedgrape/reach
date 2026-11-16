"use client"

import { useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { deleteCampaign } from "@/app/actions/campaigns"
import { AlertDialog, AlertDialogAction, AlertDialogCancelButton, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { DbCampaignWithMetrics } from "@/lib/types"

type CampaignsTableProps = {
  initialCampaigns: DbCampaignWithMetrics[]
}

function statusClass(status: string) {
  if (status === "sent") return "border-green-500/30 text-green-600"
  if (status === "sending") return "border-amber-500/30 text-amber-600"
  if (status === "scheduled") return "border-blue-500/30 text-blue-600"
  return "border-border text-muted-foreground"
}

export function CampaignsTable({ initialCampaigns }: CampaignsTableProps) {
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [selectedCampaign, setSelectedCampaign] = useState<DbCampaignWithMetrics | null>(null)
  const [isDeleting, startDeleting] = useTransition()

  const chartData = useMemo(() => {
    if (!selectedCampaign) return []
    return [
      { name: "Opened", value: selectedCampaign.metrics.opened },
      { name: "Clicked", value: selectedCampaign.metrics.clicked },
      { name: "Bounced", value: selectedCampaign.metrics.bounced },
    ]
  }, [selectedCampaign])

  function getDisplayStatus(campaign: DbCampaignWithMetrics) {
    return campaign.scheduled_at && !campaign.sent_at ? "scheduled" : campaign.status
  }

  function canDelete(campaign: DbCampaignWithMetrics) {
    return campaign.status === "draft" || campaign.status === "sent"
  }

  function onDeleteCampaign(campaignId: string) {
    startDeleting(async () => {
      const result = await deleteCampaign(campaignId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setCampaigns((prev) => prev.filter((campaign) => campaign.id !== campaignId))
      if (selectedCampaign?.id === campaignId) {
        setSelectedCampaign(null)
      }
      toast.success("Campaign deleted")
    })
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent Date</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id} className="cursor-pointer" onClick={() => setSelectedCampaign(campaign)}>
              <TableCell>
                <div className="space-y-1">
                  <p>{campaign.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Sent: {campaign.metrics.totalSent} | Opened: {campaign.metrics.opened} ({campaign.metrics.openedPct}%) |
                    Clicked: {campaign.metrics.clicked} ({campaign.metrics.clickedPct}%) | Bounced: {campaign.metrics.bounced} (
                    {campaign.metrics.bouncedPct}%)
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={statusClass(getDisplayStatus(campaign))}>{getDisplayStatus(campaign)}</Badge>
              </TableCell>
              <TableCell>{campaign.sent_at ? format(new Date(campaign.sent_at), "PPP p") : "—"}</TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                {canDelete(campaign) ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the campaign and all its send records.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancelButton>Cancel</AlertDialogCancelButton>
                        <AlertDialogAction onClick={() => onDeleteCampaign(campaign.id)} disabled={isDeleting}>
                          {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
          {!campaigns.length && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No campaigns yet. Create your first campaign today.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={!!selectedCampaign} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {selectedCampaign && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle>{selectedCampaign.title}</DialogTitle>
                <DialogDescription>Campaign details and engagement metrics.</DialogDescription>
              </DialogHeader>

              <section className="space-y-3 rounded-lg border p-4">
                <h3 className="font-medium">Campaign Info</h3>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Subject:</span> {selectedCampaign.subject}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <Badge className={statusClass(getDisplayStatus(selectedCampaign))}>{getDisplayStatus(selectedCampaign)}</Badge>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    {format(new Date(selectedCampaign.created_at), "PPP p")}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Sent:</span>{" "}
                    {selectedCampaign.sent_at ? format(new Date(selectedCampaign.sent_at), "PPP p") : "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Scheduled:</span>{" "}
                    {selectedCampaign.scheduled_at ? format(new Date(selectedCampaign.scheduled_at), "PPP p") : "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Total recipients:</span> {selectedCampaign.metrics.totalRecipients}
                  </p>
                </div>
              </section>

              <section className="space-y-4 rounded-lg border p-4">
                <h3 className="font-medium">Engagement Metrics</h3>
                {selectedCampaign.metrics.opened + selectedCampaign.metrics.clicked + selectedCampaign.metrics.bounced === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No engagement data yet. Check back after your campaign sends.
                  </p>
                ) : (
                  <>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="name" />
                          <Tooltip />
                          <Bar dataKey="value" fill="#3b82f6" radius={4} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Total sent</p>
                        <p className="text-2xl font-semibold">{selectedCampaign.metrics.totalSent}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Opened</p>
                        <p className="text-2xl font-semibold">
                          {selectedCampaign.metrics.opened} <span className="text-sm">({selectedCampaign.metrics.openedPct}%)</span>
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Clicked</p>
                        <p className="text-2xl font-semibold">
                          {selectedCampaign.metrics.clicked} <span className="text-sm">({selectedCampaign.metrics.clickedPct}%)</span>
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Bounced</p>
                        <p className="text-2xl font-semibold">
                          {selectedCampaign.metrics.bounced} <span className="text-sm">({selectedCampaign.metrics.bouncedPct}%)</span>
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
