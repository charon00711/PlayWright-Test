import { useEffect, useState } from 'react';
import { checkApiHealth } from '../api';

export function useApiHealth() {
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    checkApiHealth().then(setApiAvailable);
  }, []);

  return apiAvailable;
}
