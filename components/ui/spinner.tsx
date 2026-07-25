import { cn } from "@/lib/cn"
import { CircleDash } from "@/components/icons"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <CircleDash data-slot="spinner" role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
