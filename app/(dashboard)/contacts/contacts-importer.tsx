"use client"

import { useMemo, useState, useTransition } from "react"
import Papa from "papaparse"
import type { ParseResult } from "papaparse"
import { toast } from "sonner"

import { importContacts } from "@/app/actions/contacts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type ParsedContact = {
  email: string
  name: string
  tags: string[]
}

type ImportMode = "csv" | "paste" | "one"

function parseTags(value: string | undefined) {
  if (!value) return []
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function parseContactsFromText(value: string) {
  const emailPattern = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g
  const nameWithEmailPattern = /([^<\n\r]+?)\s*<\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\s*>/g
  const byEmail = new Map<string, ParsedContact>()

  let nameMatch: RegExpExecArray | null = nameWithEmailPattern.exec(value)
  while (nameMatch) {
    const name = nameMatch[1]?.trim().replace(/^["']|["']$/g, "") ?? ""
    const email = nameMatch[2]?.trim().toLowerCase() ?? ""
    if (email) {
      byEmail.set(email, { email, name, tags: [] })
    }
    nameMatch = nameWithEmailPattern.exec(value)
  }

  let emailMatch: RegExpExecArray | null = emailPattern.exec(value)
  while (emailMatch) {
    const email = emailMatch[1]?.trim().toLowerCase() ?? ""
    if (email && !byEmail.has(email)) {
      byEmail.set(email, { email, name: "", tags: [] })
    }
    emailMatch = emailPattern.exec(value)
  }

  return [...byEmail.values()]
}

export function ContactsImporter() {
  const [mode, setMode] = useState<ImportMode>("csv")
  const [rows, setRows] = useState<ParsedContact[]>([])
  const [pasteInput, setPasteInput] = useState("")
  const [singleName, setSingleName] = useState("")
  const [singleEmail, setSingleEmail] = useState("")
  const [isPending, startTransition] = useTransition()

  const previewRows = useMemo(() => rows.slice(0, 10), [rows])

  function handleFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result: ParseResult<Record<string, string>>) => {
        const parsedRows = result.data
          .map((row) => ({
            email: row.email?.trim().toLowerCase() ?? "",
            name: row.name?.trim() ?? "",
            tags: parseTags(row.tags),
          }))
          .filter((row) => row.email)

        if (!parsedRows.length) {
          toast.error("No valid rows found. Include an email column.")
          return
        }

        setRows(parsedRows)
      },
      error: (error: Error) => {
        toast.error(error.message)
      },
    })
  }

  function runImport(importRows: ParsedContact[]) {
    startTransition(async () => {
      const result = await importContacts(importRows)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(result.success)
      setRows([])
    })
  }

  function onSubmitPreview() {
    runImport(rows)
  }

  function parsePastedText(input: string) {
    const parsedRows = parseContactsFromText(input)
    if (!parsedRows.length) {
      toast.error("No valid emails found in pasted text.")
      return
    }
    setRows(parsedRows)
  }

  function onAddOne() {
    if (!singleEmail.trim()) {
      toast.error("Email is required.")
      return
    }
    runImport([{ email: singleEmail.trim().toLowerCase(), name: singleName.trim(), tags: [] }])
    setSingleName("")
    setSingleEmail("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Contacts</CardTitle>
        <CardDescription>Add supporters through CSV upload, pasted text extraction, or one-by-one entry.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "csv", label: "Upload CSV" },
            { id: "paste", label: "Paste Text" },
            { id: "one", label: "Add One" },
          ].map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={mode === tab.id ? "default" : "outline"}
              className={cn("w-full", mode === tab.id ? "" : "text-muted-foreground")}
              onClick={() => setMode(tab.id as ImportMode)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {mode === "csv" && (
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        )}

        {mode === "paste" && (
          <div className="space-y-3">
            <Textarea
              value={pasteInput}
              onChange={(event) => setPasteInput(event.target.value)}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text")
                if (pasted) {
                  requestAnimationFrame(() => parsePastedText(pasted))
                }
              }}
              placeholder="Paste emails, mailing list text, or Name <email> lines here."
              className="min-h-44"
            />
            <Button type="button" variant="outline" onClick={() => parsePastedText(pasteInput)}>
              Parse
            </Button>
          </div>
        )}

        {mode === "one" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              value={singleName}
              onChange={(event) => setSingleName(event.target.value)}
              placeholder="Name (optional)"
              className="sm:col-span-1"
            />
            <Input
              value={singleEmail}
              onChange={(event) => setSingleEmail(event.target.value)}
              placeholder="Email (required)"
              type="email"
              className="sm:col-span-1"
            />
            <Button type="button" onClick={onAddOne} disabled={isPending} className="sm:col-span-1">
              {isPending ? "Adding..." : "Add Contact"}
            </Button>
          </div>
        )}

        {!!rows.length && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Previewing {Math.min(rows.length, 10)} of {rows.length} row(s)
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, index) => (
                    <TableRow key={`${row.email}-${index}`}>
                      <TableCell>{row.name || "—"}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.tags.join(", ") || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={onSubmitPreview} disabled={isPending}>
              {isPending ? "Importing..." : "Confirm Import"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
