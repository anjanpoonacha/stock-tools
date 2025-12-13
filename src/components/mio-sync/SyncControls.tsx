import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { EditorWithClipboard } from '@/components/EditorWithClipboard';
import { Badge } from '@/components/ui/badge';
import { XCircle } from 'lucide-react';
import { regroupTVWatchlist, RegroupOption } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import type { Watchlist, SavedCombination } from '@/hooks/useMioSync';

const regroupOptions: { value: RegroupOption; label: string }[] = [
    { value: 'Industry', label: 'Industry' },
    { value: 'Sector', label: 'Sector' },
    { value: 'None', label: 'None' },
];

export interface SyncControlsProps {
    // State
    tvWlid: string;
    setTvWlid: (wlid: string) => void;
    mioWlid: string;
    setMioWlid: (wlid: string) => void;
    groupBy: RegroupOption;
    setGroupBy: (option: RegroupOption) => void;
    symbols: string;
    setSymbols: (symbols: string) => void;

    // Watchlists
    watchlists: Watchlist[];
    mioWatchlists: Watchlist[];

    // Loading states
    loading: boolean;
    mioWatchlistsLoading: boolean;

    // Session
    sessionId: string | null;

    // Saved combinations
    savedCombinations: SavedCombination[];
    onSaveCombination: (combo: SavedCombination) => void;
    onDeleteCombination: (index: number) => void;
    onApplyCombination: (combo: SavedCombination) => void;

    // Actions
    onSubmit: (e: React.FormEvent) => Promise<void>;
}

export const SyncControls: React.FC<SyncControlsProps> = ({
    tvWlid,
    setTvWlid,
    mioWlid,
    setMioWlid,
    groupBy,
    setGroupBy,
    symbols,
    setSymbols,
    watchlists,
    mioWatchlists,
    loading,
    mioWatchlistsLoading,
    sessionId,
    savedCombinations,
    onSaveCombination,
    onDeleteCombination,
    onApplyCombination,
    onSubmit,
}) => {
    const showToast = useToast();

    const handleSaveCombination = () => {
        if (!tvWlid || !mioWlid || !groupBy) {
            showToast('Please select all combination options before saving.', 'error');
            return;
        }
        onSaveCombination({ tvWlid, mioWlid, groupBy });
    };

    return (
        <form onSubmit={onSubmit} className='space-y-6'>
            {/* TradingView Watchlist Selector */}
            <div>
                <Label htmlFor='wlid' className='text-sm font-medium'>
                    TradingView Watchlist
                </Label>
                <Select
                    value={tvWlid}
                    onValueChange={setTvWlid}
                    disabled={!sessionId || loading || watchlists.length === 0}
                >
                    <SelectTrigger id='wlid' className='w-full mt-2'>
                        <SelectValue placeholder='Select a TradingView watchlist' />
                    </SelectTrigger>
                    <SelectContent>
                        {watchlists.map((w) => (
                            <SelectItem key={w.id} value={String(w.id)}>
                                {w.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* MIO Watchlist Selector */}
            <div>
                <Label htmlFor='mio-wlid' className='text-sm font-medium'>
                    MIO Watchlist
                </Label>
                <div className='mt-2'>
                    {mioWatchlistsLoading ? (
                        <div className='flex items-center justify-center py-4'>
                            <div className='text-sm text-gray-500'>Loading MIO watchlists...</div>
                        </div>
                    ) : (
                        <Select value={mioWlid} onValueChange={setMioWlid} disabled={mioWatchlists.length === 0}>
                            <SelectTrigger id='mio-wlid' className='w-full'>
                                <SelectValue
                                    placeholder={
                                        mioWatchlists.length === 0
                                            ? 'No MIO watchlists available'
                                            : 'Select a MIO watchlist'
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {mioWatchlists.map((w) => (
                                    <SelectItem key={w.id} value={w.id}>
                                        {w.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            {/* Group By Selector */}
            <div>
                <Label htmlFor='groupBy' className='text-sm font-medium'>
                    Group by
                </Label>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as RegroupOption)}>
                    <SelectTrigger id='groupBy' className='w-full mt-2'>
                        <SelectValue placeholder='Select grouping option' />
                    </SelectTrigger>
                    <SelectContent>
                        {regroupOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Symbol Editor */}
            <div>
                <EditorWithClipboard
                    id='symbols-editor'
                    label='Stock Symbols (MIO format)'
                    value={regroupTVWatchlist(symbols, groupBy)}
                    onChange={setSymbols}
                    placeholder='Paste or type symbols here...'
                    className='w-full font-mono text-sm'
                />
            </div>

            {/* Sync Button */}
            <Button type='submit' disabled={loading || !symbols || !sessionId || !mioWlid} className='w-full'>
                {loading ? 'Syncing...' : 'Sync to MarketInOut'}
            </Button>

            {/* Save Combination Button */}
            <Button
                type='button'
                variant='outline'
                className='w-full'
                onClick={handleSaveCombination}
            >
                Save Combination
            </Button>

            {/* Saved Combinations */}
            {savedCombinations.length > 0 && (
                <div>
                    <Label className='text-sm font-medium'>Saved Combinations</Label>
                    <div className='flex flex-wrap gap-2 mt-2'>
                        {savedCombinations.map((combo, idx) => {
                            const tvName = watchlists.find((w) => w.id === combo.tvWlid)?.name || combo.tvWlid;
                            const mioName =
                                mioWatchlists.find((w) => w.id === combo.mioWlid)?.name || combo.mioWlid;
                            return (
                                <Badge
                                    key={idx}
                                    className='cursor-pointer hover:bg-gray-100 flex items-center gap-2 px-3 py-1'
                                    onClick={() => onApplyCombination(combo)}
                                >
                                    <span className='text-xs'>
                                        {tvName} → {mioName} ({combo.groupBy})
                                    </span>
                                    <XCircle
                                        className='h-3 w-3 cursor-pointer hover:text-red-500'
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteCombination(idx);
                                        }}
                                    />
                                </Badge>
                            );
                        })}
                    </div>
                </div>
            )}
        </form>
    );
};
