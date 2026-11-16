"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { saveDraftCampaign, sendCampaign } from "@/app/actions/campaigns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type ContactOption = {
  id: string
  email: string
  name: string | null
}

type CampaignFormProps = {
  contacts: ContactOption[]
  mailingLists: Array<{ id: string; name: string }>
  listLinks: Array<{ list_id: string; contact_id: string }>
}

export function CampaignForm({ contacts, mailingLists, listLinks }: CampaignFormProps) {
  const [title, setTitle] = useState("")
  const [subject, setSubject] = useState("")
  const [bodyHtml, setBodyHtml] = useState("")
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [selectedListId, setSelectedListId] = useState("all")
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState("")
  const [isSavingDraft, startSavingDraft] = useTransition()
  const [isSending, startSending] = useTransition()

  function toggleContact(contactId: string, checked: boolean) {
    setSelectedContactIds((prev) => {
      if (checked) return [...new Set([...prev, contactId])]
      return prev.filter((id) => id !== contactId)
    })
  }

  const contactIdsForSelectedList =
    selectedListId === "all"
      ? new Set(contacts.map((contact) => contact.id))
      : new Set(listLinks.filter((link) => link.list_id === selectedListId).map((link) => link.contact_id))

  const visibleContacts = contacts.filter((contact) => contactIdsForSelectedList.has(contact.id))

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedContactIds((prev) => [...new Set([...prev, ...visibleContacts.map((contact) => contact.id)])])
      return
    }
    const visibleIds = new Set(visibleContacts.map((contact) => contact.id))
    setSelectedContactIds((prev) => prev.filter((id) => !visibleIds.has(id)))
  }

  function saveDraft() {
    const payload = new FormData()
    payload.set("title", title)
    payload.set("subject", subject)
    payload.set("bodyHtml", bodyHtml)
    payload.set("saveAsTemplate", saveAsTemplate ? "true" : "false")
    payload.set("templateName", (templateName || title).trim())

    startSavingDraft(async () => {
      const result = await saveDraftCampaign(payload)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(result.success)
    })
  }

  function handleSend() {
    const sendAt = scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : null

    startSending(async () => {
      const result = await sendCampaign({
        title,
        subject,
        bodyHtml,
        contactIds: selectedContactIds,
        scheduledAt: sendAt,
        saveAsTemplate,
        templateName: (templateName || title).trim(),
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(result.success)
      setSelectedContactIds([])
    })
  }

  const allSelected =
    visibleContacts.length > 0 && visibleContacts.every((contact) => selectedContactIds.includes(contact.id))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Campaign Builder</CardTitle>
          <CardDescription>Create warm, purposeful updates that keep your supporters informed.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Campaign title</Label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Spring Volunteer Appreciation"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Email subject</Label>
              <Input
                id="subject"
                name="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Thank you for serving our families this month"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bodyHtml">Email body</Label>
              <Textarea
                id="bodyHtml"
                name="bodyHtml"
                value={bodyHtml}
                onChange={(event) => setBodyHtml(event.target.value)}
                placeholder="<p>Hello {{name}},</p><p>We’re grateful for your continued support...</p>"
                required
              />
              <p className="text-xs text-muted-foreground">Use {"{{name}}"} to personalize each message.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={saveAsTemplate} onChange={(event) => setSaveAsTemplate(event.currentTarget.checked)} />
              Save as template for future use
            </label>
            {saveAsTemplate && (
              <div className="space-y-2">
                <Label htmlFor="templateName">Template name</Label>
                <Input
                  id="templateName"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder={title || "Template name"}
                />
              </div>
            )}
            <Button type="button" variant="outline" disabled={isSavingDraft} onClick={saveDraft}>
              {isSavingDraft ? "Saving..." : "Save Draft"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Selector</CardTitle>
          <CardDescription>Select recipients ({selectedContactIds.length} selected)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Filter by list</p>
            <select
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              value={selectedListId}
              onChange={(event) => setSelectedListId(event.target.value)}
            >
              <option value="all">All contacts</option>
              {mailingLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allSelected} onChange={(event) => toggleSelectAll(event.currentTarget.checked)} />
            Select all contacts in view
          </label>
          <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-2">
            {visibleContacts.map((contact) => (
              <label key={contact.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedContactIds.includes(contact.id)}
                  onChange={(event) => toggleContact(contact.id, event.currentTarget.checked)}
                />
                <span>{contact.name || contact.email}</span>
              </label>
            ))}
            {!visibleContacts.length && <p className="text-sm text-muted-foreground">No contacts match this list yet.</p>}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={scheduleEnabled} onChange={(event) => setScheduleEnabled(event.currentTarget.checked)} />
              Schedule for later
            </label>
            {scheduleEnabled && (
              <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.currentTarget.value)} />
            )}
          </div>

          <Button type="button" onClick={handleSend} disabled={isSending}>
            {isSending ? "Sending..." : "Send Campaign"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
