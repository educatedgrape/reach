import { ContactsImporter } from "@/app/(dashboard)/contacts/contacts-importer"
import { ContactsManager } from "@/app/(dashboard)/contacts/contacts-manager"
import { getContactsPageData } from "@/lib/data"

export default async function ContactsPage() {
  const { contacts, mailingLists, listLinks } = await getContactsPageData()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Contacts</h2>
        <p className="text-sm text-muted-foreground">Manage everyone you keep informed about your mission.</p>
      </div>

      <ContactsManager contacts={contacts} lists={mailingLists} listLinks={listLinks} />

      <ContactsImporter />
    </div>
  )
}
