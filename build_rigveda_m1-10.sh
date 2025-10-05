#!/usr/bin/env bash
set -euo pipefail
OUT="rigveda_samhita_mandalas_1-10_deva.txt"
TMPDIR="./rv_tmp"
mkdir -p "$TMPDIR"
rm -f "$OUT"

echo ">>> Building Rigveda Samhita (Mandalas 1-10) plaintext (Devanagari)..."

# 1) Primary: try GRETIL combined UTF-8 text (rvh1-10u)
GRETIL_URL="https://gretil.sub.uni-goettingen.de/gretil/1_sanskr/1_veda/1_sam/1_rv/rvh1-10u.htm"
GRETIL_FILE="$TMPDIR/rvh1-10u.htm"

echo "Trying GRETIL (preferred, UTF-8)..."
if curl -sfL "$GRETIL_URL" -o "$GRETIL_FILE"; then
  echo "Downloaded GRETIL page. Extracting Devanagari lines..."
  python3 - <<PY
import re,sys
gretil_file = "$GRETIL_FILE"
out_file = "$OUT"

inp = open(gretil_file, "rb").read().decode("utf-8", errors="ignore")
txt = re.sub(r"<[^>]+>", "\n", inp)
lines = []
for L in txt.splitlines():
    if re.search(r"[\u0900-\u097F]", L):
        lines.append(L.strip())
open(out_file, "w", encoding='utf-8').write("\n".join(lines))
print("WROTE", out_file)
PY
else
  echo "GRETIL fetch failed or unreachable. Falling back to SanskritDocuments per-mandala pages..."
  python3 - <<PY
import re,sys,os
try:
    import requests
    from bs4 import BeautifulSoup
except Exception:
    print("Installing requests and bs4...")
    os.system(sys.executable+" -m pip install requests bs4 --user")
    import requests
    from bs4 import BeautifulSoup

out_file = "$OUT"
out_lines=[]
for i in range(1,11):
    url = f"https://sanskritdocuments.org/doc_veda/r{str(i).zfill(2)}.html"
    print("Fetching", url, file=sys.stderr)
    r = requests.get(url, timeout=30)
    r.encoding = 'utf-8'
    soup = BeautifulSoup(r.text, "html.parser")
    text = soup.get_text("\n")
    for L in text.splitlines():
        if re.search(r"[\u0900-\u097F]", L):
            out_lines.append(L.strip())
with open(out_file, "w", encoding='utf-8') as f:
    f.write("\n".join(out_lines))
print("WROTE", out_file, file=sys.stderr)
PY
fi

# 3) Defensive: remove any lines/blocks containing Khila markers
python3 - <<PY
import re, os
fn = "$OUT"
tmp = fn + ".clean"
with open(fn, "r", encoding="utf-8") as f:
    lines = f.readlines()
out=[]
for L in lines:
    if re.search(r"(?i)\bkhil|खिल|खिलानि|खिलानि\b", L):
        continue
    out.append(L.rstrip())
with open(tmp, "w", encoding="utf-8") as f:
    f.write("\n".join(out))
os.replace(tmp, fn)
print("Removed lines matching 'khil' markers (if any). Final file:", fn)
PY

# 4) Normalize UTF-8 and report basic stats
echo "Normalizing and reporting stats..."
if command -v iconv >/dev/null 2>&1; then
  # Attempt to normalize the file, but don't stop the script if it fails
  iconv -f utf-8 -t utf-8 "$OUT" -o "$OUT.tmp" || true
  # *** FIX: Only move the file if the temp file was actually created ***
  if [ -f "$OUT.tmp" ]; then
    mv "$OUT.tmp" "$OUT"
  fi
fi

echo "File: $OUT"
wc -c "$OUT" || true
wc -l "$OUT" || true
echo "Sample (first 30 lines):"
head -n 30 "$OUT" || true

echo "Done. Output file is UTF-8 Devanagari plain text. Verify completeness against sources if needed."