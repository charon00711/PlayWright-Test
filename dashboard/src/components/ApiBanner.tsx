import { useApiHealth } from '../hooks/useApiHealth';

export function ApiBanner({ requireWrite = false }: { requireWrite?: boolean }) {
  const apiAvailable = useApiHealth();

  if (apiAvailable === null) return null;
  if (apiAvailable && !requireWrite) return null;

  if (!apiAvailable) {
    return (
      <div className="banner banner-warn">
        {requireWrite
          ? '写操作需要本地 API。请运行：npm run platform:dev'
          : '只读模式（静态部署）。录制、新建用例等请使用 npm run platform:dev'}
      </div>
    );
  }

  return null;
}
