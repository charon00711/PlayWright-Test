import { useApiHealth } from '../hooks/useApiHealth';

export function ApiBanner({ requireWrite = false }: { requireWrite?: boolean }) {
  const apiAvailable = useApiHealth();

  if (apiAvailable === null) return null;
  if (apiAvailable && !requireWrite) return null;

  if (!apiAvailable) {
    return (
      <div className="banner banner-warn">
        {requireWrite
          ? '写操作需要平台后端。请本地运行 npm run platform:dev，或在线配置 VITE_PLATFORM_API_URL。'
          : '当前为只读模式。完整功能需要连接平台后端（VITE_PLATFORM_API_URL）。'}
      </div>
    );
  }

  return null;
}
