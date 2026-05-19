import { useEffect, useState } from 'react';
import { fetchFeatureReleases } from '../api/client';
import { defaultReleaseMap } from '../data/featureRegistry';

interface FeatureReleasesState {
  map: Record<string, boolean>;
  loaded: boolean;
  isReleased: (key: string) => boolean;
}

// Process-wide cache. The map rarely changes during a session (only an
// admin flipping a toggle would), so one fetch per page-load is enough.
let cachedMap: Record<string, boolean> | null = null;
let inflight: Promise<Record<string, boolean>> | null = null;

function loadOnce(): Promise<Record<string, boolean>> {
  if (cachedMap) return Promise.resolve(cachedMap);
  if (inflight) return inflight;
  inflight = fetchFeatureReleases()
    .then((server) => {
      cachedMap = { ...defaultReleaseMap(), ...server };
      return cachedMap;
    })
    .catch(() => {
      cachedMap = defaultReleaseMap();
      return cachedMap;
    });
  return inflight;
}

export function useFeatureReleases(): FeatureReleasesState {
  const [map, setMap] = useState<Record<string, boolean>>(
    cachedMap ?? defaultReleaseMap(),
  );
  const [loaded, setLoaded] = useState<boolean>(cachedMap !== null);

  useEffect(() => {
    let cancelled = false;
    loadOnce().then((m) => {
      if (cancelled) return;
      setMap(m);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  return {
    map,
    loaded,
    isReleased: (key: string) => map[key] === true,
  };
}
