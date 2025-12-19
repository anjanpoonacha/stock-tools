"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type MetricVariant = "default" | "success" | "warning" | "danger"

interface MetricCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  variant?: MetricVariant
  className?: string
}

const variantStyles: Record<MetricVariant, string> = {
  default: "border-border bg-card",
  success: "border-green-500/50 bg-green-500/10",
  warning: "border-yellow-500/50 bg-yellow-500/10",
  danger: "border-red-500/50 bg-red-500/10",
}

const variantTextStyles: Record<MetricVariant, string> = {
  default: "text-foreground",
  success: "text-green-600 dark:text-green-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  danger: "text-red-600 dark:text-red-400",
}

export function MetricCard({
  label,
  value,
  icon,
  variant = "default",
  className,
}: MetricCardProps) {
  // Format value if it's a number
  const formattedValue = typeof value === "number" 
    ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : value

  return (
    <Card className={cn(variantStyles[variant], className)}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground mb-1 truncate">
              {label}
            </p>
            <p className={cn(
              "text-2xl sm:text-3xl font-bold truncate",
              variantTextStyles[variant]
            )}>
              {formattedValue}
            </p>
          </div>
          {icon && (
            <div className={cn(
              "flex-shrink-0 mt-1",
              variantTextStyles[variant]
            )}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
