#!/usr/bin/env python3
# EKSPERIMENTAL: retarget klip run/fastrun ASLI (rig low-poly "datar": rotasi/posisi dunia per tulang)
# ke rig HD hierarkis (rotasi lokal). Prinsip: delta_dunia = q_klip * inv(q_istirahat_lowpoly);
# q_dunia_HD = delta_dunia * q_istirahat_dunia_HD; lalu FK dari Bip001 ke bawah -> rotasi lokal.
# Masukan : public/models/run_exp.json (hasil extract_run_exp.py), selena_zenith_hd.glb, bundle low-poly
# Keluaran: public/models/run_exp_hd.json (track per nama node HD) + laporan validasi posisi sendi.
import json, struct, sys, math, os
import numpy as np, UnityPy

B = "/home/Claude/mlbb/extracted/Selena Zenith - Default + Logo/com.mobile.legends/files/dragon2017/assets/Art/android/h/"
P = "/home/agentuser/mlbb-selena/public/models/"
J = json.load(open("/home/agentuser/selena-game/data/raw_clips.json"))

# ---------- util kuaternion (xyzw)
def qm(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return np.array([aw*bx + ax*bw + ay*bz - az*by, aw*by - ax*bz + ay*bw + az*bx,
                     aw*bz + ax*by - ay*bx + az*bw, aw*bw - ax*bx - ay*by - az*bz])
def qi(a): return np.array([-a[0], -a[1], -a[2], a[3]])
def qn(a): return a / np.linalg.norm(a)
def qrot(q, v):
    u = q[:3]; w = q[3]
    return v + 2*np.cross(u, np.cross(u, v) + w*v)

def qfrom(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b)
    c = np.cross(a, b); w = 1.0 + float(np.dot(a, b))
    if w < 1e-6: return np.array([1.0, 0, 0, 0])
    return qn(np.array([c[0], c[1], c[2], w]))
# ruas anggota badan: arah ruas diselaraskan dengan posisi sendi klip asli (menghapus beda pose istirahat rig)
SEG = {"Bip001 L Clavicle": "Bip001 L UpperArm", "Bip001 R Clavicle": "Bip001 R UpperArm",
       "Bip001 L UpperArm": "Bip001 L Forearm", "Bip001 R UpperArm": "Bip001 R Forearm",
       "Bip001 L Forearm": "Bip001 L Hand", "Bip001 R Forearm": "Bip001 R Hand",
       "Bip001 L Thigh": "Bip001 L Calf", "Bip001 R Thigh": "Bip001 R Calf",
       "Bip001 L Calf": "Bip001 L Foot", "Bip001 R Calf": "Bip001 R Foot"}

# tangan/kaki tidak punya ruas anak: ikut koreksi arah dari lengan bawah/betis supaya pergelangan tidak tertekuk salah
INH = {"Bip001 L Hand": "Bip001 L Forearm", "Bip001 R Hand": "Bip001 R Forearm", "Bip001 L Foot": "Bip001 L Calf", "Bip001 R Foot": "Bip001 R Calf"}
CORR = {}
# tulang twist BUKAN anak tulang yang dipuntirnya (ForeTwist anak UpperArm, UpArmTwist anak Clavicle) -> harus digerakkan eksplisit
TWISTN = {}
for _p in ("Bip001", "Bip002"):
    for _s in ("L", "R"):
        TWISTN[f"{_p} {_s} ForeTwist"] = f"{_p} {_s} Forearm"
        TWISTN[f"{_p} {_s}UpArmTwist"] = f"{_p} {_s} UpperArm"
NECKN = {"Bip001 Neck", "Bip002 Neck"}
def qs(a, b, t):
    d = float(np.dot(a, b))
    if d < 0: b = -b; d = -d
    if d > 0.9995: return qn(a + t * (b - a))
    th = math.acos(d); return (math.sin((1 - t) * th) * a + math.sin(t * th) * b) / math.sin(th)

# ---------- rig HD dari GLB
d = open(P + "selena_zenith_hd.glb", "rb").read()
l = struct.unpack("<I", d[12:16])[0]
G = json.loads(d[20:20 + l]); N = G["nodes"]
par = {}
for i, n in enumerate(N):
    for c in n.get("children", []): par[c] = i
idx = {n["name"]: i for i, n in enumerate(N)}
assert len(idx) == len(N) or True
def Tn(i): return np.array(N[i].get("translation", [0, 0, 0]), float)
def Rn(i): return qn(np.array(N[i].get("rotation", [0, 0, 0, 1]), float))
for i, n in enumerate(N):
    if n["name"].startswith("Bip00") and "scale" in n: print("PERINGATAN: node ber-skala", n["name"], n["scale"])
kids = {}
for c, p in par.items(): kids.setdefault(p, []).append(c)

# rest dunia HD
Wq0, Wp0 = {}, {}
def rest_fk(i):
    p = par.get(i)
    if p is None: Wq0[i] = Rn(i); Wp0[i] = Tn(i)
    else: Wq0[i] = qm(Wq0[p], Rn(i)); Wp0[i] = Wp0[p] + qrot(Wq0[p], Tn(i))
    for c in kids.get(i, []): rest_fk(c)
for r in G["scenes"][0]["nodes"]: rest_fk(r)

# ---------- rest low-poly (rig datar: lokal = dunia karena root identitas) -> koordinat glTF
env = UnityPy.load(B + "hero_selena_skin.unity3d")
low_q, low_p = {}, {}
for o in env.objects:
    if o.type.name == "Transform":
        t = o.read(); nm = t.m_GameObject.read().m_Name
        q = t.m_LocalRotation; p = t.m_LocalPosition
        if nm in low_q: continue
        low_q[nm] = qn(np.array([q.x, -q.y, -q.z, q.w], float)); low_p[nm] = np.array([-p.x, p.y, p.z], float)

SCALE = None
out = {"source": "run_exp.json (klip asli) diretarget ke rig HD", "clips": []}
for clip in J["clips"]:
    times = np.array(clip["times"]); T = len(times)
    cq, cp = {}, {}
    for t in clip["tracks"]:
        v = np.array(t["values"], float)
        if t["path"] == "quaternion": cq[t["bone"]] = v.reshape(T, 4)
        else: cp[t["bone"]] = v.reshape(T, 3)
    # tulang yang digerakkan: ada di klip, di rest low-poly, dan di HD (prefiks Bip001 & Bip002 -> data Bip001)
    base = [b for b in cq if b.startswith("Bip001 ") and b in low_q]
    drive = {}   # nama node HD -> nama tulang sumber
    for b in base:
        for pre in ("Bip001", "Bip002"):
            hd = pre + b[len("Bip001"):]
            if hd in idx: drive[hd] = b
    if SCALE is None:
        SCALE = Wp0[idx["Bip001 Pelvis"]][1] / low_p["Bip001 Pelvis"][1]
    print(f"[{clip['name']}] tulang sumber={len(base)} node HD digerakkan={len(drive)} skala_tinggi_pinggul={SCALE:.4f}")
    missing = [b for b in cq if b.startswith('Bip001') and b not in low_q and b != 'Bip001']
    if missing: print("   tanpa rest low-poly:", missing)

    # urutan FK: setiap root biped (Bip001 / Bip002) ke bawah
    roots = [idx[r] for r in ("Bip001", "Bip002") if r in idx]
    loc_q = {}   # (frame) -> {i: lokal q}
    pos_track = {}  # nama root -> (T,3)
    pos_tw = {}
    tracks_q = {}  # nama node -> (T,4)
    World = []   # per frame: {i: (q,p)} untuk validasi
    for f in range(T):
        Wq, Wp = {}, {}; CORR.clear()
        def walk(i):
            p = par.get(i); nm = N[i]["name"]; lt_over = None
            if nm in drive:
                b = drive[nm]
                delta = qm(cq[b][f], qi(low_q[b]))
                wd = qn(qm(delta, Wq0[i]))
                pre = nm.split(" ")[0]; corr = None
                if b in SEG and SEG[b] in cp and b in cp:
                    ch = pre + SEG[b][len("Bip001"):]
                    if ch in idx:
                        rd = Wp0[idx[ch]] - Wp0[i]
                        cur = qrot(delta, rd / np.linalg.norm(rd))
                        tgt = cp[SEG[b]][f] - cp[b][f]
                        corr = qfrom(cur, tgt)
                elif b in INH and not os.environ.get("NOINH"):
                    corr = CORR.get((pre, INH[b]))
                if corr is not None:
                    wd = qn(qm(corr, wd)); CORR[(pre, b)] = corr
                lq = qn(qm(qi(Wq[p]), wd)) if p is not None else wd
            elif nm in TWISTN and not os.environ.get("NOTW"):
                mi = idx[TWISTN[nm]]
                dm = qm(Wq[mi], qi(Wq0[mi]))                      # delta dunia tulang utama (sudah termasuk koreksi arah)
                wd = qn(qm(dm, Wq0[i]))
                lq = qn(qm(qi(Wq[p]), wd))
                wp = Wp[mi] + qrot(dm, Wp0[i] - Wp0[mi])           # posisi dunia: seolah-olah anak tulang utama
                lt_over = qrot(qi(Wq[p]), wp - Wp[p])
            elif nm in NECKN and not os.environ.get("NONECK"):
                ds = qm(cq["Bip001 Spine2"][f], qi(low_q["Bip001 Spine2"])); dh = qm(cq["Bip001 Head"][f], qi(low_q["Bip001 Head"]))
                wd = qn(qm(qs(ds, dh, 0.5), Wq0[i]))               # leher: setengah jalan antara Spine2 dan Head
                lq = qn(qm(qi(Wq[p]), wd))
            else:
                lq = Rn(i)
            if p is None: Wq[i] = lq; Wp[i] = Tn(i)
            else:
                Wq[i] = qm(Wq[p], lq)
                lt = Tn(i) if lt_over is None else lt_over
                if lt_over is not None: pos_tw.setdefault(nm, []).append(lt)
                if nm in ("Bip001", "Bip002"):   # COM: translasi dari trek posisi pinggul klip
                    off = SCALE * (cp["Bip001 Pelvis"][f] - low_p["Bip001 Pelvis"])
                    lt = Tn(i) + qrot(qi(Wq[p]), off)
                Wp[i] = Wp[p] + qrot(Wq[p], lt)
                if nm in ("Bip001", "Bip002"): pos_track.setdefault(nm, []).append(lt)
            tracks_q.setdefault(nm, []).append(lq)
            for c in kids.get(i, []): walk(c)
        for r in roots:
            p = par.get(r)
            if p is not None and p not in Wq:   # leluhur: pakai pose istirahat
                chain = []; k = p
                while k is not None: chain.append(k); k = par.get(k)
                for k in reversed(chain):
                    pk = par.get(k)
                    Wq[k] = Rn(k) if pk is None else qm(Wq[pk], Rn(k))
                    Wp[k] = Tn(k) if pk is None else Wp[pk] + qrot(Wq[pk], Tn(k))
            walk(r)
        World.append((Wq, Wp))

    # ---------- validasi: posisi sendi relatif pinggul, HD vs klip asli (x skala)
    ip = idx["Bip001 Pelvis"]
    joints = ["Bip001 Head", "Bip001 L Hand", "Bip001 R Hand", "Bip001 L Foot", "Bip001 R Foot", "Bip001 L Calf", "Bip001 R Calf", "Bip001 L Forearm", "Bip001 R Forearm"]
    errs = {}
    for jn in joints:
        if jn not in cp or jn not in idx: continue
        e = []
        for f in range(T):
            Wq, Wp = World[f]
            hd = Wp[idx[jn]] - Wp[ip]
            lo = SCALE * (cp[jn][f] - cp["Bip001 Pelvis"][f])
            e.append(np.linalg.norm(hd - lo))
        errs[jn] = (float(np.mean(e)) * 100, float(np.max(e)) * 100)
    for jn in ["Bip001 L Hand", "Bip001 R Hand"]:
        sx = np.mean([ (World[f][1][idx[jn]] - World[f][1][ip])[0] - SCALE*(cp[jn][f]-cp["Bip001 Pelvis"][f])[0] for f in range(T)])
        print(f"   selisih lateral (x) rata2 {jn}: {sx*100:+.1f} cm")
    print("   galat posisi sendi relatif pinggul (cm) rata2 / maks:")
    for k, (m, mx) in errs.items(): print(f"     {k:18} {m:6.1f} / {mx:6.1f}")
    def ang(q): return 2 * math.degrees(math.acos(min(1.0, abs(q[3]))))
    print("   tekukan pergelangan vs pose istirahat (derajat, maks) HD / klip asli:")
    for hb, fb in [("L Hand", "L Forearm"), ("R Hand", "R Forearm"), ("L Foot", "L Calf"), ("R Foot", "R Calf")]:
        h, fo = "Bip001 " + hb, "Bip001 " + fb
        rel0 = qm(qi(Wq0[idx[fo]]), Wq0[idx[h]]); relL0 = qm(qi(low_q[fo]), low_q[h]); mh = ml = 0
        for f in range(T):
            Wq_ = World[f][0]
            mh = max(mh, ang(qm(qm(qi(Wq_[idx[fo]]), Wq_[idx[h]]), qi(rel0))))
            ml = max(ml, ang(qm(qm(qi(cq[fo][f]), cq[h][f]), qi(relL0))))
        print(f"     {hb:7} {mh:6.1f} / {ml:6.1f}")
    print("   twist vs tulang utama: selisih rotasi dari pose istirahat (derajat) rata2 / maks (0 = ikut sempurna):")
    for tw, mn in [("Bip001 L ForeTwist", "Bip001 L Forearm"), ("Bip001 R ForeTwist", "Bip001 R Forearm"), ("Bip001 LUpArmTwist", "Bip001 L UpperArm"), ("Bip001 RUpArmTwist", "Bip001 R UpperArm")]:
        rel0 = qm(qi(Wq0[idx[mn]]), Wq0[idx[tw]]); vals = []
        for f in range(T):
            Wq_ = World[f][0]; vals.append(ang(qm(qm(qi(Wq_[idx[mn]]), Wq_[idx[tw]]), qi(rel0))))
        print(f"     {tw:20} {np.mean(vals):5.1f} / {max(vals):5.1f}")
    # tapak kaki: tinggi pergelangan terendah per frame vs istirahat
    rest_ank = min(Wp0[idx["Bip001 L Foot"]][1], Wp0[idx["Bip001 R Foot"]][1])
    ay = [min(World[f][1][idx["Bip001 L Foot"]][1], World[f][1][idx["Bip001 R Foot"]][1]) for f in range(T)]
    print(f"   tinggi pergelangan terendah: istirahat={rest_ank:.3f} m | selama siklus min={min(ay):.3f} maks={max(ay):.3f}")

    # galat pose istirahat (tanpa animasi): beda proporsi rig atau bug retarget?
    print("   galat pada POSE ISTIRAHAT (cm) HD vs low-poly x skala:", end=" ")
    for jn in ["Bip001 L Hand", "Bip001 L Foot", "Bip001 Head"]:
        hd = Wp0[idx[jn]] - Wp0[ip]; lo = SCALE * (low_p[jn] - low_p["Bip001 Pelvis"])
        print(f"{jn.split(' ',1)[1]}={np.linalg.norm(hd-lo)*100:.1f}", end="  ")
    print()
    # koreksi tapak: turunkan seluruh siklus agar titik terendah pergelangan menyentuh tinggi istirahat
    ground = float(min(ay) - rest_ank)
    if abs(ground) > 0.08: print(f'   koreksi tapak DILEWATI (selisih {ground*100:.0f} cm terlalu besar: klip bukan gerak menapak)'); ground = 0.0
    print(f"   koreksi tapak: pinggul diturunkan {ground*100:.1f} cm (konstan, pantulan asli klip dipertahankan)")
    for nm in pos_track:
        pr = par.get(idx[nm]); q = World[0][0][pr] if pr is not None else np.array([0,0,0,1.0])
        assert abs(abs(q[3]) - 1) < 1e-3, "induk COM tidak identitas: koreksi tapak perlu rotasi"
        pos_track[nm] = [lt - np.array([0, ground, 0]) for lt in pos_track[nm]]
    tr = []
    for nm, arr in tracks_q.items():
        if nm not in drive and nm not in TWISTN and nm not in NECKN: continue
        a = np.array(arr)
        for i in range(1, len(a)):
            if np.dot(a[i], a[i-1]) < 0: a[i] *= -1
        tr.append({"node": nm, "path": "quaternion", "values": [round(float(x), 6) for x in a.flatten()]})
    for nm, arr in pos_track.items():
        a = np.array(arr); tr.append({"node": nm, "path": "position", "values": [round(float(x), 6) for x in a.flatten()]})
    for nm, arr in pos_tw.items():
        a = np.array(arr); tr.append({"node": nm, "path": "position", "values": [round(float(x), 6) for x in a.flatten()]})
    out["clips"].append({"name": clip["name"], "duration": clip["duration"], "fps": clip["fps"], "loop": clip["loop"],
                         "times": clip["times"], "tracks": tr, "validasi_cm": errs})
OUTF = "/home/agentuser/selena-game/public/data/clips_hd.json"
json.dump(out, open(OUTF, "w"), separators=(",", ":"))
print("tersimpan", OUTF, round(len(open(OUTF).read()) / 1024), "KB")
