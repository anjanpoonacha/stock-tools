"use client"

import * as React from "react"
import { DashboardLayout } from "@/components/dashboard/DashboardLayout"
import { SystemParameters } from "@/components/calculators/system/SystemParameters"
import { BucketSection } from "@/components/calculators/system/BucketSection"
import { PerformanceMetrics } from "@/components/calculators/system/PerformanceMetrics"
import { 
  calculateSystemMetrics, 
  getDefaultBucketSections,
  BucketSection as BucketSectionType,
  SystemMetrics
} from "@/lib/calculators/expectancy"

export default function SystemAnalyzerPage() {
  const [rValue, setRValue] = React.useState(20000)
  const [totalTrades, setTotalTrades] = React.useState(160)
  const [compoundQuarterly, setCompoundQuarterly] = React.useState(false)
  
  const defaultSections = React.useMemo(() => getDefaultBucketSections(), [])
  const [breakevenSection, setBreakevenSection] = React.useState<BucketSectionType>(
    defaultSections.breakeven
  )
  const [losingSection, setLosingSection] = React.useState<BucketSectionType>(
    defaultSections.losing
  )
  const [winningSection, setWinningSection] = React.useState<BucketSectionType>(
    defaultSections.winning
  )
  
  const [metrics, setMetrics] = React.useState<SystemMetrics | null>(null)

  // Calculate metrics whenever inputs change
  React.useEffect(() => {
    try {
      const calculatedMetrics = calculateSystemMetrics(
        breakevenSection,
        losingSection,
        winningSection,
        totalTrades,
        rValue,
        compoundQuarterly
      )
      setMetrics(calculatedMetrics)
    } catch (error) {
      // Invalid state, don't update metrics
      console.error("Calculation error:", error)
      setMetrics(null)
    }
  }, [breakevenSection, losingSection, winningSection, totalTrades, rValue, compoundQuarterly])

  // Calculate section percentages validation
  const totalSectionPercentage = 
    breakevenSection.sectionPercentage + 
    losingSection.sectionPercentage + 
    winningSection.sectionPercentage
  const isSectionPercentageInvalid = Math.abs(totalSectionPercentage - 100) > 0.01

  return (
    <DashboardLayout showHero={false} showSidebar={true}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Trading System Analyzer
          </h1>
          <p className="text-muted-foreground mt-2">
            Calculate expectancy and profitability using R-multiples (Champion Calculator)
          </p>
        </div>

        {/* Section Percentage Validation Alert */}
        {isSectionPercentageInvalid && (
          <div className="p-4 rounded-lg border border-destructive bg-destructive/10">
            <p className="text-sm text-destructive font-medium">
              Section percentages must sum to 100% (currently: {totalSectionPercentage.toFixed(1)}%)
            </p>
          </div>
        )}

        {/* Two-Column Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Inputs */}
          <div className="space-y-6">
            <SystemParameters
              rValue={rValue}
              totalTrades={totalTrades}
              onRValueChange={setRValue}
              onTotalTradesChange={setTotalTrades}
            />

            <BucketSection
              section={breakevenSection}
              onSectionChange={setBreakevenSection}
            />

            <BucketSection
              section={losingSection}
              onSectionChange={setLosingSection}
            />

            <BucketSection
              section={winningSection}
              onSectionChange={setWinningSection}
            />
          </div>

          {/* Right Column - Metrics */}
          <div>
            {metrics && !isSectionPercentageInvalid ? (
              <PerformanceMetrics
                metrics={metrics}
                compoundQuarterly={compoundQuarterly}
                onCompoundChange={setCompoundQuarterly}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-8">
                  <p className="text-muted-foreground mb-2">
                    {isSectionPercentageInvalid 
                      ? "Fix section percentages to view metrics"
                      : "Adjust parameters to calculate metrics"}
                  </p>
                  {!isSectionPercentageInvalid && (
                    <p className="text-xs text-muted-foreground">
                      Ensure all section bucket percentages sum to 100%
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Information Footer */}
        <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-2">About R-Multiples & Champion Calculator:</p>
          <p>
            This calculator uses a three-section bucket system: <strong>Breakeven</strong> (near-zero trades), 
            <strong> Losing</strong> (negative R), and <strong>Winning</strong> (positive R). 
            Each section represents a percentage of your total trades, and within each section, 
            you distribute trades across different R-multiples. The expectancy shows your average 
            profit/loss per trade - positive expectancy indicates a profitable system over the long term.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
