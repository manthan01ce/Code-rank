import AnalyticsDashboard from '@/features/analytics/AnalyticsDashboard';
import { pageMetadata } from '@/lib/site-config';

export const metadata=pageMetadata('Operations analytics | CodeRank','Private operational monitoring for CodeRank.');
export default function AnalyticsPage(){return <AnalyticsDashboard/>;}
