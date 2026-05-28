import { NavLink, Outlet } from 'react-router-dom';
import { FloatingAiAssistant } from './FloatingAiAssistant';
import { ToastProvider } from './ToastProvider';
import {
  IconCases,
  IconDashboard,
  IconImport,
  IconLogo,
  IconRecorder,
  IconReports,
  IconSchedule,
  IconLiveLog,
  IconAi,
  IconPerf,
  IconApiCase,
} from './NavIcons';

const navItems = [
  { to: '/', end: true, label: '仪表盘', Icon: IconDashboard },
  { to: '/recorder', label: '录制测试', Icon: IconRecorder },
  { to: '/cases', label: '用例管理', Icon: IconCases },
  { to: '/api-cases', label: '接口管理', Icon: IconApiCase },
  { to: '/import', label: 'Markdown 导入', Icon: IconImport },
  { to: '/reports', label: '测试报告', Icon: IconReports },
  { to: '/scheduler', label: '定时中心', Icon: IconSchedule },
  { to: '/live-logs', label: '实时日志', Icon: IconLiveLog },
  { to: '/ai', label: 'AI 中心', Icon: IconAi },
  { to: '/perf', label: '性能中心', Icon: IconPerf },
];

export function Layout() {
  return (
    <ToastProvider>
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <IconLogo className="brand-icon" />
          <h1>Playwright测试平台</h1>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, end, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `nav-item${isActive ? ' active' : ''}`
              }
            >
              <Icon className="nav-icon" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <Outlet />
      </main>
      <FloatingAiAssistant />
    </div>
    </ToastProvider>
  );
}
