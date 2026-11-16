"use client"

import { useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import { toast } from "sonner"

import { addContactsToList, createMailingList, deleteMailingList } from "@/app/actions/contacts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { DbContact, MailingList } from "@/lib/types"

type ContactsManagerProps = {
  contacts: DbContact[]
  lists: Array<MailingList & { contactCount: number }>
  listLinks: Array<{ list_id: string; contact_id: string }>
}

type SortColumn = "name" | "email" | "imported_at"

export function ContactsManager({ contacts, lists, listLinks }: ContactsManagerProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("imported_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [selectedListId, setSelectedListId] = useState<string>("all")
  const [targetListId, setTargetListId] = useState<string>("")
  const [newListName, setNewListName] = useState("")
  const [localLists, setLocalLists] = useState(lists)
  const [localLinks, setLocalLinks] = useState(listLinks)
  const [isPending, startTransition] = useTransition()

  const contactIdsByList = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const link of localLinks) {
      const set = map.get(link.list_id) ?? new Set<string>()
      set.add(link.contact_id)
      map.set(link.list_id, set)
    }
    return map
  }, [localLinks])

  const filteredContacts = useMemo(() => {
    const base =
      selectedListId === "all"
        ? contacts
        : contacts.filter((contact) => (contactIdsByList.get(selectedListId) ?? new Set<string>()).has(contact.id))

    return [...base].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1
      if (sortColumn === "imported_at") {
        return (new Date(a.imported_at).getTime() - new Date(b.imported_at).getTime()) * direction
      }
      return (String(a[sortColumn] ?? "").localeCompare(String(b[sortColumn] ?? "")) || 0) * direction
    })
  }, [contacts, contactIdsByList, selectedListId, sortColumn, sortDirection])

  const allVisibleSelected = filteredContacts.length > 0 && filteredContacts.every((contact) => selectedContactIds.includes(contact.id))

  function toggleSort(column: SortColumn) {
    setSortDirection((prev) => (sortColumn === column ? (prev === "asc" ? "desc" : "asc") : "asc"))
    setSortColumn(column)
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      const ids = filteredContacts.map((contact) => contact.id)
      setSelectedContactIds((prev) => [...new Set([...prev, ...ids])])
      return
    }
    const visibleIds = new Set(filteredContacts.map((contact) => contact.id))
    setSelectedContactIds((prev) => prev.filter((id) => !visibleIds.has(id)))
  }

  function toggleContact(contactId: string, checked: boolean) {
    setSelectedContactIds((prev) => (checked ? [...new Set([...prev, contactId])] : prev.filter((id) => id !== contactId)))
  }

  function addToExistingList() {
    if (!targetListId || !selectedContactIds.length) {
      toast.error("Select contacts and a list first.")
      return
    }

    startTransition(async () => {
      const result = await addContactsToList({ listId: targetListId, contactIds: selectedContactIds })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setLocalLinks((prev) => [
        ...prev,
        ...selectedContactIds.map((contactId) => ({ list_id: targetListId, contact_id: contactId })),
      ])
      toast.success(result.success)
    })
  }

  function createListAndAssign() {
    if (!newListName.trim() || !selectedContactIds.length) {
      toast.error("Provide a new list name and select contacts.")
      return
    }

    startTransition(async () => {
      const createResult = await createMailingList(newListName)
      if (createResult.error || !createResult.listId) {
        toast.error(createResult.error ?? "Unable to create list.")
        return
      }
      const addResult = await addContactsToList({ listId: createResult.listId, contactIds: selectedContactIds })
      if (addResult.error) {
        toast.error(addResult.error)
        return
      }
      setLocalLists((prev) => [...prev, { id: createResult.listId!, org_id: "", name: createResult.listName!, created_at: "", contactCount: 0 }])
      setLocalLinks((prev) => [
        ...prev,
        ...selectedContactIds.map((contactId) => ({ list_id: createResult.listId!, contact_id: contactId })),
      ])
      setNewListName("")
      toast.success(addResult.success)
    })
  }

  function removeList(listId: string) {
    startTransition(async () => {
      const result = await deleteMailingList(listId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setLocalLists((prev) => prev.filter((list) => list.id !== listId))
      setLocalLinks((prev) => prev.filter((link) => link.list_id !== listId))
      if (selectedListId === listId) setSelectedListId("all")
      toast.success("List deleted")
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Mailing Lists</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <button className="w-full rounded-md border px-3 py-2 text-left text-sm" onClick={() => setSelectedListId("all")}>
            All Contacts ({contacts.length})
          </button>
          {localLists.map((list) => {
            const count = (contactIdsByList.get(list.id) ?? new Set<string>()).size
            return (
              <div key={list.id} className="flex items-center gap-2">
                <button className="flex-1 rounded-md border px-3 py-2 text-left text-sm" onClick={() => setSelectedListId(list.id)}>
                  {list.name} ({count})
                </button>
                <Button type="button" variant="outline" size="sm" onClick={() => removeList(list.id)} disabled={isPending}>
                  ×
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imported Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 overflow-x-auto">
          {!!selectedContactIds.length && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm">Selected {selectedContactIds.length} contact(s)</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-lg border bg-background px-3 text-sm"
                  value={targetListId}
                  onChange={(event) => setTargetListId(event.target.value)}
                >
                  <option value="">Add to list...</option>
                  {localLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                  <option value="new">New list...</option>
                </select>
                {targetListId === "new" ? (
                  <>
                    <Input value={newListName} onChange={(event) => setNewListName(event.target.value)} placeholder="New list name" />
                    <Button type="button" onClick={createListAndAssign} disabled={isPending}>
                      Create + Add
                    </Button>
                  </>
                ) : (
                  <Button type="button" onClick={addToExistingList} disabled={isPending || !targetListId}>
                    Add to list
                  </Button>
                )}
              </div>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Checkbox checked={allVisibleSelected} onChange={(event) => toggleSelectAll(event.currentTarget.checked)} />
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("name")}>Name {sortColumn === "name" ? (sortDirection === "asc" ? "↑" : "↓") : ""}</button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("email")}>
                    Email {sortColumn === "email" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("imported_at")}>
                    Imported {sortColumn === "imported_at" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedContactIds.includes(contact.id)}
                      onChange={(event) => toggleContact(contact.id, event.currentTarget.checked)}
                    />
                  </TableCell>
                  <TableCell>{contact.name || "—"}</TableCell>
                  <TableCell>{contact.email}</TableCell>
                  <TableCell>{contact.tags || "—"}</TableCell>
                  <TableCell>{format(new Date(contact.imported_at), "PPP")}</TableCell>
                </TableRow>
              ))}
              {!filteredContacts.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No contacts yet. Import a CSV to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
