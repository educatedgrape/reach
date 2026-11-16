"use client"

import { useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import { Pause, Pencil, Play, Trash } from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  createAutomation,
  deleteAutomation,
  toggleAutomationStatus,
  updateAutomation,
} from "@/app/actions/automations"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancelButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  AutomatedCampaign,
  AutomatedCampaignRun,
  MailingList,
  QuickSendTemplate,
} from "@/lib/types"

type RunWithName = AutomatedCampaignRun & {
  automated_campaigns?: { name: string } | null
}

type AutomateClientProps = {
  automations: AutomatedCampaign[]
  runs: RunWithName[]
  templates: QuickSendTemplate[]
  mailingLists: Array<MailingList & { contactCount: number }>
}

type Frequency = "daily" | "weekly" | "monthly" | "custom"

type FormState = {
  name: string
  templateId: string
  mailingListId: string
  frequency: Frequency
  customIntervalDays: number
  sendTime: string
  startDate: string
  endDate: string
  noEndDate: boolean
}

const defaultForm: FormState = {
  name: "",
  templateId: "",
  mailingListId: "",
  frequency: "weekly",
  customIntervalDays: 7,
  sendTime: "09:00",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  noEndDate: true,
}

function formatFrequencyLabel(input: {
  frequency: Frequency
  custom_interval_days: number | null
}) {
  if (input.frequency === "daily") return "Daily"
  if (input.frequency === "weekly") return "Weekly"
  if (input.frequency === "monthly") return "Monthly"
  return `Every ${Math.max(input.custom_interval_days ?? 1, 1)} days`
}

function statusClass(status: string) {
  if (status === "active") return "border-green-500/30 text-green-600"
  if (status === "paused") return "border-yellow-500/30 text-yellow-600"
  return "border-border text-muted-foreground"
}

export function AutomateClient({
  automations,
  runs,
  templates,
  mailingLists,
}: AutomateClientProps) {
  const [localAutomations, setLocalAutomations] = useState(automations)
  const [localRuns] = useState(runs)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAutomation, setEditingAutomation] =
    useState<AutomatedCampaign | null>(null)
  const [deleteAutomationId, setDeleteAutomationId] = useState<string | null>(
    null
  )
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [isPending, startTransition] = useTransition()

  const templateById = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates]
  )
  const listById = useMemo(
    () => new Map(mailingLists.map((list) => [list.id, list])),
    [mailingLists]
  )

  function openCreate() {
    setEditingAutomation(null)
    setStep(1)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  function openEdit(automation: AutomatedCampaign) {
    setEditingAutomation(automation)
    setStep(1)
    setForm({
      name: automation.name,
      templateId: automation.template_id ?? "",
      mailingListId: automation.mailing_list_id ?? "",
      frequency: automation.frequency,
      customIntervalDays: automation.custom_interval_days ?? 7,
      sendTime: automation.send_time.slice(0, 5),
      startDate: automation.start_date,
      endDate: automation.end_date ?? "",
      noEndDate: !automation.end_date,
    })
    setDialogOpen(true)
  }

  function saveAutomation() {
    startTransition(async () => {
      const payload = {
        name: form.name,
        templateId: form.templateId || null,
        mailingListId: form.mailingListId || null,
        frequency: form.frequency,
        customIntervalDays:
          form.frequency === "custom" ? form.customIntervalDays : null,
        sendTime: form.sendTime,
        startDate: form.startDate,
        endDate: form.noEndDate ? null : form.endDate || null,
      } as const

      const result = editingAutomation
        ? await updateAutomation(editingAutomation.id, payload)
        : await createAutomation(payload)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(result.success)
      setDialogOpen(false)
    })
  }

  function onToggleStatus(automation: AutomatedCampaign) {
    startTransition(async () => {
      const result = await toggleAutomationStatus(automation.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(result.success)
      setLocalAutomations((prev) =>
        prev.map((item) =>
          item.id === automation.id
            ? {
                ...item,
                status: automation.status === "active" ? "paused" : "active",
                next_run_at: item.next_run_at,
              }
            : item
        )
      )
    })
  }

  function onDelete() {
    if (!deleteAutomationId) return
    startTransition(async () => {
      const result = await deleteAutomation(deleteAutomationId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(result.success)
      setLocalAutomations((prev) =>
        prev.filter((item) => item.id !== deleteAutomationId)
      )
      setDeleteAutomationId(null)
    })
  }

  const reviewFrequency = formatFrequencyLabel({
    frequency: form.frequency,
    custom_interval_days:
      form.frequency === "custom" ? form.customIntervalDays : null,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Automate</h2>
          <p className="text-sm text-muted-foreground">
            Set up scheduled campaign sends and review run history.
          </p>
        </div>
        <Button onClick={openCreate}>New Automation</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Automations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Mailing List</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localAutomations.map((automation) => (
                <TableRow key={automation.id}>
                  <TableCell>{automation.name}</TableCell>
                  <TableCell>
                    {automation.template_id
                      ? (templateById.get(automation.template_id)?.name ?? "—")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {automation.mailing_list_id
                      ? (listById.get(automation.mailing_list_id)?.name ?? "—")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {formatFrequencyLabel({
                      frequency: automation.frequency,
                      custom_interval_days: automation.custom_interval_days,
                    })}
                  </TableCell>
                  <TableCell>
                    {automation.next_run_at
                      ? format(new Date(automation.next_run_at), "PPP p")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {automation.last_run_at
                      ? format(new Date(automation.last_run_at), "PPP p")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusClass(automation.status)}>
                      {automation.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => onToggleStatus(automation)}
                        disabled={isPending}
                        title={
                          automation.status === "active" ? "Pause" : "Resume"
                        }
                      >
                        {automation.status === "active" ? (
                          <Pause size={14} />
                        ) : (
                          <Play size={14} />
                        )}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => openEdit(automation)}
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => setDeleteAutomationId(automation.id)}
                        title="Delete"
                      >
                        <Trash size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!localAutomations.length && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No automations yet.
                    <div className="mt-3">
                      <Button onClick={openCreate}>Create Automation</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Schedules are saved and ready to run.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Run History</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Automation Name</TableHead>
                <TableHead>Ran At</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    {run.automated_campaigns?.name ?? "Unknown"}
                  </TableCell>
                  <TableCell>{format(new Date(run.ran_at), "PPP p")}</TableCell>
                  <TableCell>{run.recipients_count ?? 0}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        run.status === "completed"
                          ? "border-green-500/30 text-green-600"
                          : "border-red-500/30 text-red-600"
                      }
                    >
                      {run.status ?? "failed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!localRuns.length && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    No runs yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAutomation ? "Edit Automation" : "Create Automation"}
            </DialogTitle>
            <DialogDescription>
              Configure schedule and recipients for automated sends.
            </DialogDescription>
          </DialogHeader>

          {!editingAutomation && (
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span
                className={step === 1 ? "font-semibold text-foreground" : ""}
              >
                Setup
              </span>
              <span>•</span>
              <span
                className={step === 2 ? "font-semibold text-foreground" : ""}
              >
                Schedule
              </span>
              <span>•</span>
              <span
                className={step === 3 ? "font-semibold text-foreground" : ""}
              >
                Review
              </span>
            </div>
          )}

          {(editingAutomation || step === 1) && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Automation name</Label>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Template</Label>
                <select
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                  value={form.templateId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      templateId: event.target.value,
                    }))
                  }
                >
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} — {template.subject}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Mailing list</Label>
                <select
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                  value={form.mailingListId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      mailingListId: event.target.value,
                    }))
                  }
                >
                  <option value="">Select list</option>
                  {mailingLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.contactCount})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {(editingAutomation || step === 2) && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {["daily", "weekly", "monthly", "custom"].map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="radio"
                        checked={form.frequency === option}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            frequency: option as Frequency,
                          }))
                        }
                      />
                      <span>{option[0].toUpperCase() + option.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>
              {form.frequency === "custom" && (
                <div className="space-y-2">
                  <Label>Repeat every X days</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.customIntervalDays}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        customIntervalDays: Math.max(
                          Number(event.target.value || 1),
                          1
                        ),
                      }))
                    }
                  />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Send time</Label>
                  <Input
                    type="time"
                    value={form.sendTime}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        sendTime: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.noEndDate}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      noEndDate: event.currentTarget.checked,
                    }))
                  }
                />
                No end date
              </label>
              {!form.noEndDate && (
                <div className="space-y-2">
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        endDate: event.target.value,
                      }))
                    }
                  />
                </div>
              )}
            </div>
          )}

          {!editingAutomation && step === 3 && (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Name:</span> {form.name}
              </p>
              <p>
                <span className="text-muted-foreground">Template:</span>{" "}
                {templateById.get(form.templateId)?.name || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Mailing list:</span>{" "}
                {listById.get(form.mailingListId)?.name || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Schedule:</span>{" "}
                {`${reviewFrequency} at ${form.sendTime} starting ${form.startDate}${form.noEndDate ? " (runs indefinitely)" : ` until ${form.endDate}`}`}
              </p>
            </div>
          )}

          <DialogFooter>
            {!editingAutomation && step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
              >
                Back
              </Button>
            )}
            {!editingAutomation && step < 3 ? (
              <Button
                onClick={() => setStep((prev) => (prev + 1) as 1 | 2 | 3)}
              >
                Next
              </Button>
            ) : (
              <Button onClick={saveAutomation} disabled={isPending}>
                {isPending
                  ? "Saving..."
                  : editingAutomation
                    ? "Save"
                    : "Create Automation"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteAutomationId}
        onOpenChange={(open) => !open && setDeleteAutomationId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this automation?</AlertDialogTitle>
            <AlertDialogDescription>
              All run history will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancelButton>Cancel</AlertDialogCancelButton>
            <AlertDialogAction onClick={onDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
