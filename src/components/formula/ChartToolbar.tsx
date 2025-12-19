/**
 * ChartToolbar - Left-side vertical toolbar with chart controls
 *
 * Contains all chart configuration controls:
 * - View mode toggle (single/dual)
 * - Layout mode toggle (horizontal/vertical)
 * - Range sync toggle
 * - Resolution settings popover
 * - Grid toggle
 * - CVD indicator settings popover
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
	LayoutGrid,
	LayoutList,
	Clock,
	Grid3x3,
	TrendingUp,
	LayoutPanelLeft,
	LayoutPanelTop,
	Link,
	Unlink,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChartZoomLevel } from '@/lib/chart/types';
import { ZOOM_LABELS } from '@/lib/chart/constants';
import type { ChartSettings } from '@/hooks/useKVSettings';

// Resolution configurations
const RESOLUTIONS = [
	{ value: '1', label: '1min', barsCount: 500 },
	{ value: '5', label: '5min', barsCount: 1000 },
	{ value: '15', label: '15min', barsCount: 2000 },
	{ value: '75', label: '75min', barsCount: 1500 },
	{ value: '188', label: '188min', barsCount: 1000 },
	{ value: '1D', label: '1D', barsCount: 2000 },
	{ value: '1W', label: '1W', barsCount: 1500 },
	{ value: '1M', label: '1M', barsCount: 1000 },
] as const;

const CVD_ANCHOR_PERIODS = [
	{ value: '1M', label: '1 Month' },
	{ value: '3M', label: '3 Months' },
	{ value: '6M', label: '6 Months' },
	{ value: '1Y', label: '1 Year' },
] as const;

const CVD_CUSTOM_PERIODS = [
	{ value: '15S', label: '15 Seconds' },
	{ value: '30S', label: '30 Seconds' },
	{ value: '1', label: '1 Minute' },
	{ value: '5', label: '5 Minutes' },
	{ value: '15', label: '15 Minutes' },
] as const;

interface ChartToolbarProps {
	chartSettings: ChartSettings;
	layoutMode: 'horizontal' | 'vertical';
	rangeSync: boolean;
	onUpdateSetting: <K extends keyof ChartSettings>(key: K, value: ChartSettings[K]) => void;
	onToggleLayoutMode: () => void;
	onToggleRangeSync: () => void;
}

export function ChartToolbar({
	chartSettings,
	layoutMode,
	rangeSync,
	onUpdateSetting,
	onToggleLayoutMode,
	onToggleRangeSync,
}: ChartToolbarProps) {
	const {
		resolution1,
		resolution2,
		zoomLevel1,
		zoomLevel2,
		showCVD,
		cvdAnchorPeriod,
		cvdUseCustomPeriod,
		cvdCustomPeriod,
		showGrid,
		dualViewMode,
	} = chartSettings;

	return (
		<div className='h-full w-full bg-muted/30 border-r border-border flex flex-col items-center py-4 gap-3'>
			{/* View Mode Toggle Button */}
			<Button
				variant={dualViewMode ? 'default' : 'outline'}
				size='icon'
				onClick={() => onUpdateSetting('dualViewMode', !dualViewMode)}
				className='h-10 w-10'
				title={`View Mode: ${dualViewMode ? 'Dual' : 'Single'}`}
			>
				{dualViewMode ? <LayoutGrid className='h-5 w-5' /> : <LayoutList className='h-5 w-5' />}
			</Button>

			<Separator className='w-10' />

			{/* Layout Mode Toggle (only in dual view) */}
			{dualViewMode && (
				<>
					<Button
						variant='outline'
						size='icon'
						onClick={onToggleLayoutMode}
						className='h-10 w-10'
						title={`Layout: ${layoutMode === 'horizontal' ? 'Horizontal' : 'Vertical'}`}
					>
						{layoutMode === 'horizontal' ? (
							<LayoutPanelLeft className='h-5 w-5' />
						) : (
							<LayoutPanelTop className='h-5 w-5' />
						)}
					</Button>

					{/* Range Sync Lock/Unlock Button */}
					<Button
						variant={rangeSync ? 'default' : 'outline'}
						size='icon'
						onClick={onToggleRangeSync}
						className='h-10 w-10'
						title={rangeSync ? 'Range Sync: Locked' : 'Range Sync: Unlocked'}
					>
						{rangeSync ? <Link className='h-5 w-5' /> : <Unlink className='h-5 w-5' />}
					</Button>

					<Separator className='w-10' />
				</>
			)}

			{/* Resolution Popover */}
			<Popover>
				<PopoverTrigger asChild>
					<Button variant='outline' size='icon' className='h-10 w-10 relative' title='Resolution Settings'>
						<Clock className='h-5 w-5' />
						<span className='absolute -bottom-1 -right-1 text-[8px] bg-primary text-primary-foreground rounded px-1 font-mono'>
							{resolution1}
						</span>
					</Button>
				</PopoverTrigger>
				<PopoverContent side='right' className='w-[280px]'>
					<div className='space-y-4'>
						<h3 className='text-sm font-semibold'>Resolution Settings</h3>

						{/* Resolution 1 */}
						<div className='space-y-2'>
							<Label className='text-xs'>{dualViewMode ? 'Resolution 1' : 'Resolution'}</Label>
							<Select value={resolution1} onValueChange={(val) => onUpdateSetting('resolution1', val)}>
								<SelectTrigger className='h-9'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{RESOLUTIONS.map((res) => (
										<SelectItem key={res.value} value={res.value}>
											{res.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Resolution 2 (if dual mode) */}
						{dualViewMode && (
							<div className='space-y-2'>
								<Label className='text-xs'>Resolution 2</Label>
								<Select value={resolution2} onValueChange={(val) => onUpdateSetting('resolution2', val)}>
									<SelectTrigger className='h-9'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{RESOLUTIONS.map((res) => (
											<SelectItem key={res.value} value={res.value}>
												{res.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}

						{/* Zoom Level */}
						<div className='space-y-2'>
							<Label className='text-xs'>{dualViewMode ? 'Zoom Level 1' : 'Zoom Level'}</Label>
							<div className='grid grid-cols-4 gap-1'>
								{Object.values(ChartZoomLevel).map((level) => (
									<Button
										key={level}
										variant={zoomLevel1 === level ? 'default' : 'outline'}
										size='sm'
										onClick={() => onUpdateSetting('zoomLevel1', level)}
										className='h-8 text-xs'
									>
										{ZOOM_LABELS[level]}
									</Button>
								))}
							</div>
						</div>

						{/* Zoom Level 2 (if dual mode) */}
						{dualViewMode && (
							<div className='space-y-2'>
								<Label className='text-xs'>Zoom Level 2</Label>
								<div className='grid grid-cols-4 gap-1'>
									{Object.values(ChartZoomLevel).map((level) => (
										<Button
											key={level}
											variant={zoomLevel2 === level ? 'default' : 'outline'}
											size='sm'
											onClick={() => onUpdateSetting('zoomLevel2', level)}
											className='h-8 text-xs'
										>
											{ZOOM_LABELS[level]}
										</Button>
									))}
								</div>
							</div>
						)}
					</div>
				</PopoverContent>
			</Popover>

			<Separator className='w-10' />

			{/* Grid Toggle Button */}
			<Button
				variant={showGrid ? 'default' : 'outline'}
				size='icon'
				onClick={() => onUpdateSetting('showGrid', !showGrid)}
				className='h-10 w-10'
				title={showGrid ? 'Hide Grid' : 'Show Grid'}
			>
				<Grid3x3 className='h-5 w-5' />
			</Button>

			<Separator className='w-10' />

			{/* CVD Settings Popover */}
			<Popover>
				<PopoverTrigger asChild>
					<Button variant='outline' size='icon' className='h-10 w-10 relative' title='CVD Indicator Settings'>
						<TrendingUp className='h-5 w-5' />
						{showCVD && (
							<span className='absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-background' />
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent side='right' className='w-[320px]'>
					<div className='space-y-4'>
						<div className='flex items-center justify-between'>
							<h3 className='text-sm font-semibold'>CVD Indicator</h3>
							<Checkbox
								id='cvd-toggle-popup'
								checked={showCVD}
								onCheckedChange={(checked) => onUpdateSetting('showCVD', checked === true)}
							/>
						</div>

						{showCVD && (
							<div className='space-y-3 pt-2 border-t'>
								{/* Anchor Period */}
								<div className='space-y-2'>
									<Label className='text-xs'>Anchor Period</Label>
									<Select
										value={cvdAnchorPeriod}
										onValueChange={(val) => onUpdateSetting('cvdAnchorPeriod', val)}
									>
										<SelectTrigger className='h-9'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{CVD_ANCHOR_PERIODS.map((period) => (
												<SelectItem key={period.value} value={period.value}>
													{period.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								{/* Use Custom Period */}
								<div className='flex items-center gap-2'>
									<Checkbox
										id='cvd-custom-popup'
										checked={cvdUseCustomPeriod}
										onCheckedChange={(checked) => onUpdateSetting('cvdUseCustomPeriod', checked === true)}
									/>
									<Label htmlFor='cvd-custom-popup' className='text-xs cursor-pointer'>
										Use Custom Period
									</Label>
								</div>

								{/* Custom Period */}
								{cvdUseCustomPeriod && (
									<div className='space-y-2'>
										<Label className='text-xs'>Custom Period</Label>
										<Select
											value={cvdCustomPeriod}
											onValueChange={(val) => onUpdateSetting('cvdCustomPeriod', val)}
										>
											<SelectTrigger className='h-9'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{CVD_CUSTOM_PERIODS.map((period) => (
													<SelectItem key={period.value} value={period.value}>
														{period.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</div>
						)}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
