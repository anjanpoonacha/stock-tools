import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import StockFormatConverter from '../StockFormatConverter';

export default function ConverterPage() {
    return (
        <DashboardLayout showHero={false} showSidebar={true}>
            <div className='max-w-7xl mx-auto'>
                <StockFormatConverter />
            </div>
        </DashboardLayout>
    );
}
