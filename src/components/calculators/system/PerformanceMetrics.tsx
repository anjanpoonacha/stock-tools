"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SystemMetrics } from "@/lib/calculators/expectancy"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { TrendingUp, Target, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

interface PerformanceMetricsProps {
  metrics: SystemMetrics
  compoundQuarterly: boolean
  onCompoundChange: (value: boolean) => void
}

export function PerformanceMetrics({
  metrics,
  compoundQuarterly,
  onCompoundChange,
}: PerformanceMetricsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  const formatR = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)} R`
  }

  const isPositiveExpectancy = metrics.expectancy > 0

  return (
    <div className="space-y-6">
      {/* Expectancy Highlight Card */}
      <Card className={cn(
        "border-2",
        isPositiveExpectancy 
          ? "border-green-500/50 bg-green-500/5" 
          : "border-red-500/50 bg-red-500/5"
      )}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className={cn(
              "w-5 h-5",
              isPositiveExpectancy ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )} />
            System Expectancy
          </CardTitle>
          <CardDescription>
            Average profit/loss per trade in R-multiples
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">
            <span className={cn(
              isPositiveExpectancy 
                ? "text-green-600 dark:text-green-400" 
                : "text-red-600 dark:text-red-400"
            )}>
              {formatR(metrics.expectancy)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {isPositiveExpectancy 
              ? "Positive expectancy - Profitable system" 
              : "Negative expectancy - Losing system"}
          </p>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>
            Win rate and average gain/loss statistics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MetricItem
            label="Win Rate"
            value={formatPercent(metrics.winRate)}
            icon={<TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />}
          />

          <div className="grid grid-cols-2 gap-4">
            <MetricItem
              label="Average Gain"
              value={formatR(metrics.avgWin)}
              subtext="Winners only"
            />
            <MetricItem
              label="Average Loss"
              value={formatR(-metrics.avgLoss)}
              subtext="Losers only"
            />
          </div>

          <MetricItem
            label="Avg Gain : Loss (ARR)"
            value={metrics.arr.toFixed(2)}
            icon={<Activity className="w-4 h-4 text-primary" />}
            subtext="Risk-Reward Ratio"
          />

          <MetricItem
            label="Average Loss (BE)"
            value={formatR(-metrics.avgLossBE)}
            subtext="Breakeven trades"
          />
        </CardContent>
      </Card>

      {/* Profit Projections */}
      <Card>
        <CardHeader>
          <CardTitle>Profit Projections</CardTitle>
          <CardDescription>
            Total profit over {metrics.totalTrades} trades
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <MetricItem
              label="Net Gain (Simple)"
              value={`${metrics.netGainR.toFixed(0)} R`}
              subtext={formatCurrency(metrics.netGainCurrency)}
              large
            />
            <p className="text-xs text-muted-foreground mt-1">No compounding</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="compound-switch" className="cursor-pointer">
                Quarterly Compounding
              </Label>
              <Switch
                id="compound-switch"
                checked={compoundQuarterly}
                onCheckedChange={onCompoundChange}
              />
            </div>

            {compoundQuarterly && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <MetricItem
                  label="Net Gain (Compounded)"
                  value={`${metrics.netGainCompoundedR.toFixed(0)} R`}
                  subtext={formatCurrency(metrics.netGainCompoundedCurrency)}
                  large
                />
                <p className="text-xs text-muted-foreground mt-1">With quarterly compounding</p>
              </div>
            )}
          </div>

          {compoundQuarterly && metrics.totalTrades < 4 && (
            <p className="text-xs text-muted-foreground">
              Note: Minimum 4 trades required for quarterly compounding
            </p>
          )}
        </CardContent>
      </Card>

      {/* Trade Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Trade Distribution</CardTitle>
          <CardDescription>
            Breakdown of trades by outcome
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-2 rounded bg-muted">
            <span className="text-sm">Breakeven:</span>
            <span className="text-sm font-semibold">
              {metrics.breakevenTrades} trades ({((metrics.breakevenTrades / metrics.totalTrades) * 100).toFixed(0)}%)
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-red-500/10">
            <span className="text-sm text-red-700 dark:text-red-300">Losing:</span>
            <span className="text-sm font-semibold text-red-700 dark:text-red-300">
              {metrics.losingTrades} trades ({((metrics.losingTrades / metrics.totalTrades) * 100).toFixed(0)}%)
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-green-500/10">
            <span className="text-sm text-green-700 dark:text-green-300">Winning:</span>
            <span className="text-sm font-semibold text-green-700 dark:text-green-300">
              {metrics.winningTrades} trades ({((metrics.winningTrades / metrics.totalTrades) * 100).toFixed(0)}%)
            </span>
          </div>

          <div className="pt-2 border-t flex items-center justify-between">
            <span className="text-sm font-medium">Winners + Losers:</span>
            <span className="text-sm font-semibold">{metrics.winnersAndLosers} trades</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface MetricItemProps {
  label: string
  value: string
  subtext?: string
  icon?: React.ReactNode
  large?: boolean
}

function MetricItem({ label, value, subtext, icon, large }: MetricItemProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className={cn(
        "font-semibold",
        large ? "text-2xl" : "text-lg"
      )}>
        {value}
      </div>
      {subtext && (
        <p className="text-xs text-muted-foreground">{subtext}</p>
      )}
    </div>
  )
}
