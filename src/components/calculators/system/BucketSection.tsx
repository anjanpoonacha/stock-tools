"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"
import { BucketSection as BucketSectionType, SectionBucket } from "@/lib/calculators/expectancy"
import { cn } from "@/lib/utils"

interface BucketSectionProps {
  section: BucketSectionType
  onSectionChange: (section: BucketSectionType) => void
}

export function BucketSection({ section, onSectionChange }: BucketSectionProps) {
  const sectionTitles = {
    breakeven: "Breakeven Buckets",
    losing: "Losing Buckets",
    winning: "Winning Buckets",
  }

  const sectionDescriptions = {
    breakeven: "Near-breakeven trades with minimal loss",
    losing: "Losing trades distributed by R-multiple",
    winning: "Winning trades distributed by R-multiple",
  }

  const sectionColors = {
    breakeven: "text-muted-foreground",
    losing: "text-red-600 dark:text-red-400",
    winning: "text-green-600 dark:text-green-400",
  }

  const handleSectionPercentageChange = (value: number) => {
    onSectionChange({
      ...section,
      sectionPercentage: Math.max(0, Math.min(100, value)),
    })
  }

  const handleBucketChange = (
    bucketId: string,
    field: keyof SectionBucket,
    value: number
  ) => {
    const updatedBuckets = section.buckets.map((bucket) => {
      if (bucket.id === bucketId) {
        return { ...bucket, [field]: value }
      }
      return bucket
    })
    onSectionChange({ ...section, buckets: updatedBuckets })
  }

  const handleAddBucket = () => {
    const newBucket: SectionBucket = {
      id: `${section.name}-${Date.now()}`,
      rMultiple: section.name === 'winning' ? 1.0 : -1.0,
      percentageInSection: 0,
      trades: 0,
    }
    onSectionChange({
      ...section,
      buckets: [...section.buckets, newBucket],
    })
  }

  const handleRemoveBucket = (bucketId: string) => {
    if (section.buckets.length > 1) {
      onSectionChange({
        ...section,
        buckets: section.buckets.filter((b) => b.id !== bucketId),
      })
    }
  }

  const totalPercentageInSection = section.buckets.reduce(
    (sum, b) => sum + b.percentageInSection,
    0
  )
  const isPercentageInvalid = Math.abs(totalPercentageInSection - 100) > 0.01

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className={cn("flex items-center gap-2", sectionColors[section.name])}>
              {sectionTitles[section.name]}
            </CardTitle>
            <CardDescription>{sectionDescriptions[section.name]}</CardDescription>
          </div>
          <div className="text-right">
            <Label htmlFor={`${section.name}-section-pct`} className="text-xs text-muted-foreground">
              % of Total
            </Label>
            <Input
              id={`${section.name}-section-pct`}
              type="number"
              step="1"
              min="0"
              max="100"
              value={section.sectionPercentage}
              onChange={(e) => handleSectionPercentageChange(parseFloat(e.target.value) || 0)}
              className="w-20 h-8 text-center text-sm font-semibold"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Within-Section Percentage Indicator */}
        <div
          className={cn(
            "flex items-center justify-between p-2 rounded-lg border text-xs",
            isPercentageInvalid
              ? "bg-destructive/10 border-destructive"
              : "bg-muted border-border"
          )}
        >
          <span className="font-medium">Within-Section Total:</span>
          <span
            className={cn(
              "font-bold",
              isPercentageInvalid ? "text-destructive" : "text-foreground"
            )}
          >
            {totalPercentageInSection.toFixed(1)}%
          </span>
        </div>

        {/* Bucket List */}
        <div className="space-y-2">
          {section.buckets.map((bucket) => (
            <div
              key={bucket.id}
              className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 p-2 rounded-lg border bg-card"
            >
              <div className="space-y-1">
                <Label htmlFor={`r-${bucket.id}`} className="text-xs">
                  R-Multiple
                </Label>
                <Input
                  id={`r-${bucket.id}`}
                  type="number"
                  step="0.1"
                  value={bucket.rMultiple}
                  onChange={(e) =>
                    handleBucketChange(bucket.id, "rMultiple", parseFloat(e.target.value) || 0)
                  }
                  className={cn(
                    "h-8 text-sm",
                    bucket.rMultiple > 0.1
                      ? "text-green-600 dark:text-green-400 font-semibold"
                      : bucket.rMultiple < -0.1
                      ? "text-red-600 dark:text-red-400 font-semibold"
                      : "text-muted-foreground"
                  )}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor={`pct-${bucket.id}`} className="text-xs">
                  % in Section
                </Label>
                <Input
                  id={`pct-${bucket.id}`}
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={bucket.percentageInSection}
                  onChange={(e) =>
                    handleBucketChange(
                      bucket.id,
                      "percentageInSection",
                      parseFloat(e.target.value) || 0
                    )
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor={`trades-${bucket.id}`} className="text-xs">
                  Trades
                </Label>
                <Input
                  id={`trades-${bucket.id}`}
                  type="number"
                  value={bucket.trades}
                  disabled
                  className="h-8 text-sm bg-muted"
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleRemoveBucket(bucket.id)}
                  disabled={section.buckets.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Bucket Button */}
        <Button variant="outline" size="sm" onClick={handleAddBucket} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Bucket
        </Button>

        {/* Subtotal */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between font-semibold">
            <span>SUBTOTAL:</span>
            <span>
              {section.sectionPercentage}% ({section.totalTrades} trades)
            </span>
          </div>
        </div>

        {isPercentageInvalid && (
          <p className="text-xs text-destructive">
            Note: Bucket percentages within this section must sum to 100%
          </p>
        )}
      </CardContent>
    </Card>
  )
}
