import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CaseForm } from './pages/CaseForm';
import { CasesList } from './pages/CasesList';
import { Dashboard } from './pages/Dashboard';
import { ImportMarkdown } from './pages/ImportMarkdown';
import { Recorder } from './pages/Recorder';
import { ApiDebug } from './pages/ApiDebug';
import { ApiCasesList } from './pages/ApiCasesList';
import { ApiCaseForm } from './pages/ApiCaseForm';
import { ApiRunsList } from './pages/ApiRunsList';
import { ScheduleCenter } from './pages/ScheduleCenter';
import { LiveLogs } from './pages/LiveLogs';
import { AiCenter } from './pages/AiCenter';
import { PerfCenter } from './pages/PerfCenter';
import { Reports } from './pages/Reports';
import { ReportsRunDetail } from './pages/ReportsRunDetail';

function LegacyRunRedirect() {
  const { runId } = useParams();
  return <Navigate to={`/reports/runs/${runId}`} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="recorder" element={<Recorder />} />
          <Route path="cases" element={<CasesList />} />
          <Route path="cases/new" element={<CaseForm />} />
          <Route path="cases/:id/edit" element={<CaseForm />} />
          <Route path="import" element={<ImportMarkdown />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/runs/:runId" element={<ReportsRunDetail />} />
          <Route path="scheduler" element={<ScheduleCenter />} />
          <Route path="live-logs" element={<LiveLogs />} />
          <Route path="ai" element={<AiCenter />} />
          <Route path="perf" element={<PerfCenter />} />
          <Route path="api-cases" element={<ApiCasesList />} />
          <Route path="api-cases/new" element={<ApiCaseForm />} />
          <Route path="api-cases/runs" element={<ApiRunsList />} />
          <Route path="api-cases/:id/edit" element={<ApiCaseForm />} />
          <Route path="api-debug" element={<ApiDebug />} />
          <Route path="runs" element={<Navigate to="/reports" replace />} />
          <Route path="runs/:runId" element={<LegacyRunRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
