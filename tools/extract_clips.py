#!/usr/bin/env python3
# Ekstrak klip ASLI Selena (rig low-poly, kurva Transform generik) dari hero_selena_skin.unity3d.
# Mendukung StreamedClip (polinom kubik per segmen) + DenseClip + ConstantClip. Hasil: data/raw_clips.json
# (per NAMA tulang, koordinat glTF: posisi x dibalik, kuaternion y&z dibalik). Skala & renderer dilewati.
import UnityPy, zlib, json, struct, sys, bisect
import numpy as np

B = "/home/Claude/mlbb/extracted/Selena Zenith - Default + Logo/com.mobile.legends/files/dragon2017/assets/Art/android/h/"
GLB = "/home/agentuser/mlbb-selena/public/models/selena_zenith_hd.glb"
OUT = "/home/agentuser/selena-game/data/raw_clips.json"
WANT = sys.argv[1:] or ["run", "fastrun", "fight_idle", "recall", "birth", "dead", "attack1", "attack2",
                        "skill1", "skill2", "skill3_1", "skill3_2", "landing", "verigo"]

d = open(GLB, "rb").read(); l = struct.unpack("<I", d[12:16])[0]; j = json.loads(d[20:20 + l]); N = j["nodes"]; par = {}
for i, n in enumerate(N):
    for c in n.get("children", []): par[c] = i
def gpath(i):
    p = []
    while i is not None: p.append(N[i]["name"]); i = par.get(i)
    return "/".join(reversed(p))
cands = {gpath(i) for i in range(len(N))}
env = UnityPy.load(B + "hero_selena_skin.unity3d")
tr = {o.path_id: o.read() for o in env.objects if o.type.name == "Transform"}
def tname(t): return t.m_GameObject.read().m_Name
def tpath(t):
    s = []
    while t: s.append(tname(t)); t = t.m_Father.read() if t.m_Father and t.m_Father.path_id else None
    return "/".join(reversed(s))
cands |= {tpath(t) for t in tr.values()}
H = {}
for p in cands:
    segs = p.split("/")
    for k in range(len(segs)):
        s = "/".join(segs[k:]); H.setdefault(zlib.crc32(s.encode()) & 0xffffffff, s)
hd_names = {n["name"] for n in N}

def parse_streamed(words):
    buf = struct.pack("<%dI" % len(words), *[w & 0xffffffff for w in words]); pos = 0; curves = {}
    while pos + 8 <= len(buf):
        t, = struct.unpack_from("<f", buf, pos); pos += 4
        n, = struct.unpack_from("<i", buf, pos); pos += 4
        for _ in range(n):
            idx, = struct.unpack_from("<i", buf, pos); pos += 4
            co = struct.unpack_from("<4f", buf, pos); pos += 16
            if t != float("inf"): curves.setdefault(idx, []).append((t, co))
    for k in curves: curves[k].sort(key=lambda x: x[0])
    return curves
def eval_stream(keys, t):
    ts = [k[0] for k in keys]; i = max(0, bisect.bisect_right(ts, t + 1e-6) - 1)
    tk, (a, b, c, dd) = keys[i]; dt = t - tk
    return ((a * dt + b) * dt + c) * dt + dd

out = {"source": "hero_selena_skin.unity3d", "clips": []}
for o in env.objects:
    if o.type.name != "AnimationClip": continue
    c = o.read()
    if c.m_Name not in WANT: continue
    mc = c.m_MuscleClip; cl = mc.m_Clip.data
    sc, dc, kc = cl.m_StreamedClip, cl.m_DenseClip, cl.m_ConstantClip.data
    S, D, nF, sr = sc.curveCount, dc.m_CurveCount, dc.m_FrameCount, float(dc.m_SampleRate)
    stop = float(mc.m_StopTime); nUse = int(round(stop * sr)) + 1; times = np.arange(nUse) / sr
    streamed = parse_streamed(list(sc.data)); dense = np.array(dc.m_SampleArray, np.float64).reshape(nF, D) if D else np.zeros((0, 0))
    const = np.array(kc, np.float64)
    def col(k):
        if k < S:
            keys = streamed.get(k)
            return np.array([eval_stream(keys, t) for t in times]) if keys else np.zeros(nUse)
        k -= S
        if k < D: return dense[np.minimum(np.arange(nUse), nF - 1), k]
        return np.full(nUse, const[k - D])
    idx = 0; tracks = []; unresolved = 0; skipped = 0
    for b in c.m_ClipBindingConstant.genericBindings:
        n = {1: 3, 2: 4, 3: 3}[b.attribute] if b.typeID == 4 else 1
        if b.typeID != 4 or b.attribute == 3: skipped += 1; idx += n; continue
        if b.path not in H: unresolved += 1; idx += n; continue
        cols = np.stack([col(idx + i) for i in range(n)], 1); idx += n
        name = H[b.path].split("/")[-1]
        if b.attribute == 1:
            cols = cols.copy(); cols[:, 0] *= -1; kind = "position"
        else:
            nn = np.linalg.norm(cols, axis=1, keepdims=True); nn[nn == 0] = 1; cols = cols / nn
            cols[:, 1] *= -1; cols[:, 2] *= -1; kind = "quaternion"
            for i in range(1, len(cols)):
                if np.dot(cols[i], cols[i - 1]) < 0: cols[i] *= -1
        tracks.append({"bone": name, "path": kind, "values": [round(float(x), 5) for x in cols.flatten()]})
    assert idx == S + D + len(const), (c.m_Name, idx, S + D + len(const))
    nm = {t["bone"] for t in tracks}
    print(f"{c.m_Name:11} stop={stop:4.2f}s T={nUse:3} S/D/C={S}/{D}/{len(const)} tracks={len(tracks):3} unresolved={unresolved:2} skip(skala/lain)={skipped:2} bone_di_HD={sum(1 for x in nm if x in hd_names)}/{len(nm)}")
    out["clips"].append({"name": c.m_Name, "duration": stop, "fps": sr, "loop": bool(mc.m_LoopTime), "times": [round(float(t), 5) for t in times], "tracks": tracks})
json.dump(out, open(OUT, "w"), separators=(",", ":"))
print("tersimpan", OUT, round(len(open(OUT).read()) / 1024), "KB")
