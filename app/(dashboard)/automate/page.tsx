import { AutomateClient } from "@/app/(dashboard)/automate/automate-client"
import { getAutomatePageData } from "@/lib/data"

export default async function AutomatePage() {
  const data = await getAutomatePageData()
  return (
    <AutomateClient
      automations={data.automations}
      runs={data.runs}
      templates={data.templates}
      mailingLists={data.mailingLists}
    />
  )
}
