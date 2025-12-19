"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp } from "lucide-react"

interface CalculatorCardProps {
  title: string
  children: React.ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
  className?: string
}

export function CalculatorCard({
  title,
  children,
  collapsible = false,
  defaultCollapsed = false,
  className,
}: CalculatorCardProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)

  const toggleCollapse = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed)
    }
  }

  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardHeader 
        className={cn(
          "pb-4",
          collapsible && "cursor-pointer select-none hover:bg-muted/50 transition-colors"
        )}
        onClick={toggleCollapse}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl sm:text-2xl">{title}</CardTitle>
          {collapsible && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={isCollapsed ? "Expand section" : "Collapse section"}
            >
              {isCollapsed ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronUp className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="space-y-4 sm:space-y-6">
          {children}
        </CardContent>
      )}
    </Card>
  )
}
