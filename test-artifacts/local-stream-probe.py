#!/usr/bin/env python3
"""Probe the new streaming run-tests flow:
  1. POST /api/analysis/run-tests with a fresh client-generated runId.
  2. Open SSE on /api/analysis/run-events/:runId?token=...
  3. Print every event as it lands. Confirms compile_run rows arrive
     before unit_test rows (the whole point of the redesign).
"""
import json, os, random, string, sys, time, urllib.request, urllib.error

BASE = os.environ.get("BASE", "http://127.0.0.1:3001")

def post(path, body, token=None):
    data = json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method="POST")
    req.add_header("content-type", "application/json")
    if token:
        req.add_header("authorization", "Bearer " + token)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())

def get(path):
    with urllib.request.urlopen(BASE + path, timeout=30) as r:
        return json.loads(r.read().decode())

def fresh_run_id():
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"run_{int(time.time()*1000):x}_{rand}"

def main():
    acc = get("/auth/test-accounts")
    username = next((a["username"] for a in acc["accounts"] if not a["claimed"]), acc["accounts"][0]["username"])
    print("username=", username)
    token = post("/auth/claim", {"username": username})["token"]

    code = (
        '#include <string>\n'
        'class StreamProbeSingleton {\n'
        'public:\n'
        '    static StreamProbeSingleton& getInstance() {\n'
        '        static StreamProbeSingleton instance;\n'
        '        return instance;\n'
        '    }\n'
        '    StreamProbeSingleton(const StreamProbeSingleton&) = delete;\n'
        '    StreamProbeSingleton& operator=(const StreamProbeSingleton&) = delete;\n'
        'private:\n'
        '    StreamProbeSingleton() = default;\n'
        '};\n'
    )

    analyze = post("/api/analyze", {"filename": "stream_probe.cpp", "code": code}, token)
    print("pendingId=", analyze.get("pendingId"))

    client_run_id = fresh_run_id()
    print("clientRunId=", client_run_id)

    ack = post("/api/analysis/run-tests", {
        "pendingId": analyze["pendingId"],
        "runId": client_run_id,
        "classResolvedPatterns": {},
        "stdin": ""
    }, token)
    print("ack=", ack)
    if not ack.get("accepted"):
        print("server says already running:", ack)
        # Continue anyway — should get same runId stream
    server_run_id = ack["runId"]

    sse_url = f"{BASE}/api/analysis/run-events/{server_run_id}?token={token}"
    print("subscribing to", sse_url)

    req = urllib.request.Request(sse_url, headers={"accept": "text/event-stream"})
    started = time.time()
    timestamps = []
    with urllib.request.urlopen(req, timeout=180) as r:
        buf = b""
        while True:
            chunk = r.read1(4096) if hasattr(r, "read1") else r.read(4096)
            if not chunk:
                break
            buf += chunk
            while b"\n\n" in buf:
                frame, buf = buf.split(b"\n\n", 1)
                lines = frame.decode().splitlines()
                ev_type = next((l[7:].strip() for l in lines if l.startswith("event: ")), None)
                data_line = next((l[6:] for l in lines if l.startswith("data: ")), None)
                if ev_type and data_line:
                    elapsed = time.time() - started
                    timestamps.append((elapsed, ev_type))
                    print(f"  +{elapsed:.2f}s  event={ev_type}  data={data_line[:300]}")
                    if ev_type == "done":
                        print("\n--- timing summary ---")
                        for t, e in timestamps:
                            print(f"  {t:6.2f}s  {e}")
                        return

if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as e:
        print("HTTPError", e.code, e.read().decode()[:500])
        sys.exit(2)
