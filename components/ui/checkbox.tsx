import * as React from "react"

import { cn } from "@/lib/utils"

type CheckboxProps = Omit<React.ComponentProps<"input">, "type">

function Checkbox({ className, ...props }: CheckboxProps) {
  return <input type="checkbox" className={cn("size-4 rounded border border-input accent-primary", className)} {...props} />
}

export { Checkbox }
