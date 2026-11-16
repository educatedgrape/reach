"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { PaperPlaneRight, Pencil, Plus, Trash } from "@phosphor-icons/react"

import {
  createQuickSendTemplate,
  deleteQuickSendTemplate,
  sendQuickSendTemplate,
  updateQuickSendTemplate,
} from "@/app/actions/quick-send-templates"
import { AlertDialog, AlertDialogAction, AlertDialogCancelButton, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { QuickSendTemplate } from "@/lib/types"

type QuickSendContact = {
  id: string
  email: string
  name: string | null
}

type QuickSendProps = {
  templates: QuickSendTemplate[]
  contacts: QuickSendContact[]
  mailingLists: Array<{ id: string; name: string }>
  listLinks: Array<{ list_id: string; contact_id: string }>
}

export function QuickSend({ templates, contacts, mailingLists, listLinks }: QuickSendProps) {
  const [localTemplates, setLocalTemplates] = useState(templates)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<QuickSendTemplate | null>(null)
  const [templateName, setTemplateName] = useState("")
  const [subject, setSubject] = useState("")
  const [bodyHtml, setBodyHtml] = useState("")
  const [templateDefaultListIds, setTemplateDefaultListIds] = useState<string[]>([])
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [selectedListIds, setSelectedListIds] = useState<string[]>([])
  const [isSending, startSending] = useTransition()
  const [isSaving, startSaving] = useTransition()
  const [isDeleting, startDeleting] = useTransition()

  const contactIdsForList =
    selectedListIds.length === 0
      ? new Set(contacts.map((contact) => contact.id))
      : new Set(listLinks.filter((link) => selectedListIds.includes(link.list_id)).map((link) => link.contact_id))
  const visibleContacts = contacts.filter((contact) => contactIdsForList.has(contact.id))
  const allSelected = visibleContacts.length > 0 && visibleContacts.every((contact) => selectedContactIds.includes(contact.id))

  const selectedCount = useMemo(() => selectedContactIds.length, [selectedContactIds])

  function openCreateTemplate() {
    setEditingTemplate(null)
    setTemplateName("")
    setSubject("")
    setBodyHtml("")
    setTemplateDefaultListIds([])
    setTemplateDialogOpen(true)
  }

  function openEditTemplate(template: QuickSendTemplate) {
    setEditingTemplate(template)
    setTemplateName(template.name)
    setSubject(template.subject)
    setBodyHtml(template.body_html)
    setTemplateDefaultListIds(template.default_list_ids ?? [])
    setTemplateDialogOpen(true)
  }

  function openSendTemplate(template: QuickSendTemplate) {
    setEditingTemplate(template)
    setSubject(template.subject)
    setBodyHtml(template.body_html)
    setSelectedContactIds([])
    setSelectedListIds(template.default_list_ids ?? [])
    setSendDialogOpen(true)
  }

  function toggleTemplateDefaultList(listId: string, checked: boolean) {
    setTemplateDefaultListIds((prev) => (checked ? [...new Set([...prev, listId])] : prev.filter((id) => id !== listId)))
  }

  function toggleSendList(listId: string, checked: boolean) {
    setSelectedListIds((prev) => (checked ? [...new Set([...prev, listId])] : prev.filter((id) => id !== listId)))
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedContactIds((prev) => [...new Set([...prev, ...visibleContacts.map((contact) => contact.id)])])
      return
    }
    const visibleIds = new Set(visibleContacts.map((contact) => contact.id))
    setSelectedContactIds((prev) => prev.filter((id) => !visibleIds.has(id)))
  }

  function toggleContact(contactId: string, checked: boolean) {
    setSelectedContactIds((prev) => {
      if (checked) return [...new Set([...prev, contactId])]
      return prev.filter((id) => id !== contactId)
    })
  }

  function saveTemplate() {
    startSaving(async () => {
      const payload = { name: templateName, subject, bodyHtml, listIds: templateDefaultListIds }
      const result = editingTemplate
        ? await updateQuickSendTemplate(editingTemplate.id, payload)
        : await createQuickSendTemplate(payload)
      if (result.error || !result.template) {
        toast.error(result.error ?? "Unable to save template.")
        return
      }
      setLocalTemplates((prev) => {
        if (editingTemplate) return prev.map((item) => (item.id === result.template.id ? result.template : item))
        return [result.template, ...prev]
      })
      toast.success(editingTemplate ? "Template updated." : "Template saved.")
      setTemplateDialogOpen(false)
    })
  }

  function confirmDeleteTemplate() {
    if (!editingTemplate) return
    startDeleting(async () => {
      const result = await deleteQuickSendTemplate(editingTemplate.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setLocalTemplates((prev) => prev.filter((item) => item.id !== editingTemplate.id))
      toast.success("Template deleted.")
      setDeleteDialogOpen(false)
    })
  }

  function handleSendTemplate() {
    if (!editingTemplate) return
    startSending(async () => {
      const result = await sendQuickSendTemplate({
        templateId: editingTemplate.id,
        subject,
        bodyHtml,
        contactIds: selectedContactIds,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`${result.sentCount ?? selectedCount} emails sent.`)
      setSelectedContactIds([])
      setSendDialogOpen(false)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Send Templates</CardTitle>
        <CardDescription>Create reusable messages and send quickly to selected contacts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!localTemplates.length && (
          <p className="text-sm text-muted-foreground">No templates yet. Create your first quick send template.</p>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {localTemplates.map((template) => (
            <div key={template.id} className="rounded-lg border p-4">
              <p className="font-semibold">{template.name}</p>
              <p className="truncate text-sm text-muted-foreground">{template.subject}</p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{template.body_html}</p>
              <div className="mt-3 flex gap-2">
                <Button size="icon-sm" variant="outline" onClick={() => openSendTemplate(template)}>
                  <PaperPlaneRight />
                </Button>
                <Button size="icon-sm" variant="outline" onClick={() => openEditTemplate(template)}>
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => {
                    setEditingTemplate(template)
                    setDeleteDialogOpen(true)
                  }}
                >
                  <Trash />
                </Button>
              </div>
            </div>
          ))}
          <button
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-muted-foreground"
            onClick={openCreateTemplate}
          >
            <Plus size={20} />
            <span>New Template</span>
          </button>
        </div>

        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
              <DialogDescription>Save reusable quick send content for your outreach campaigns.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea className="min-h-44" value={bodyHtml} onChange={(event) => setBodyHtml(event.target.value)} />
                <p className="text-xs text-muted-foreground">Use {"{{name}}"} to personalize each message.</p>
              </div>
              <div className="space-y-2 rounded-lg border p-3">
                <Label>Default mailing lists</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {mailingLists.map((list) => (
                    <label key={list.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={templateDefaultListIds.includes(list.id)}
                        onChange={(event) => toggleTemplateDefaultList(list.id, event.currentTarget.checked)}
                      />
                      <span>{list.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveTemplate} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate?.name}</DialogTitle>
              <DialogDescription>Review and send this template now.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea className="min-h-32" value={bodyHtml} onChange={(event) => setBodyHtml(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Filter by list</Label>
                <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                  {mailingLists.map((list) => (
                    <label key={list.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedListIds.includes(list.id)}
                        onChange={(event) => toggleSendList(list.id, event.currentTarget.checked)}
                      />
                      <span>{list.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2 rounded-lg border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={allSelected} onChange={(event) => toggleSelectAll(event.currentTarget.checked)} />
                  Select all contacts in view ({selectedCount} selected)
                </label>
                <div className="grid gap-2 md:grid-cols-2">
                  {visibleContacts.map((contact) => (
                    <label key={contact.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedContactIds.includes(contact.id)}
                        onChange={(event) => toggleContact(contact.id, event.currentTarget.checked)}
                      />
                      <span>{contact.name || contact.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSendTemplate} disabled={isSending}>
                {isSending ? "Sending..." : "Send Now"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this template?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancelButton>Cancel</AlertDialogCancelButton>
              <AlertDialogAction onClick={confirmDeleteTemplate} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
