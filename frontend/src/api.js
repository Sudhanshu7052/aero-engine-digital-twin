import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

async function post(path, body) {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${path}`);
  }
  return res.json();
}

async function get(path) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  return res.json();
}

export function useDigitalTwin() {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [replay, setReplay] = useState(null); // { active, label, index, total, row }
  const wsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => !cancelled && setConnected(true);
      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        retryTimer = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.type === "state") {
          setState(msg.data);
        } else if (msg.type === "replay_start") {
          setReplay({ active: true, label: msg.data.label, index: 0, total: msg.data.total, row: null });
        } else if (msg.type === "replay_row") {
          setReplay({
            active: true,
            label: replayLabelRef.current,
            index: msg.data.index + 1,
            total: msg.data.total,
            row: msg.data,
          });
        } else if (msg.type === "replay_end") {
          setReplay((r) => (r ? { ...r, active: false } : null));
        }
      };
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replayLabelRef = useRef(null);
  useEffect(() => {
    if (replay?.label) replayLabelRef.current = replay.label;
  }, [replay?.label]);

  useEffect(() => {
    get("/state")
      .then(setState)
      .catch(() => {});
  }, []);

  const startSim = useCallback(() => post("/sim/start"), []);
  const stopSim = useCallback(() => post("/sim/stop"), []);
  const injectFault = useCallback((type) => post("/fault", { type }), []);
  const clearFault = useCallback(() => post("/fault/clear"), []);
  const setManualTarget = useCallback((body) => post("/manual-target", body), []);
  const startMission = useCallback((body) => post("/missions/start", body), []);
  const replayMission = useCallback((id) => post(`/missions/${id}/replay`), []);
  const fetchMissions = useCallback(() => get("/missions"), []);
  const fetchMissionProfiles = useCallback(() => get("/missions/profiles"), []);
  const fetchFaultTypes = useCallback(() => get("/faults"), []);

  return {
    state,
    connected,
    replay,
    startSim,
    stopSim,
    injectFault,
    clearFault,
    setManualTarget,
    startMission,
    replayMission,
    fetchMissions,
    fetchMissionProfiles,
    fetchFaultTypes,
  };
}
