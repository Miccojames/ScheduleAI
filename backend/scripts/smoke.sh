#!/usr/bin/env bash
# =============================================================================
# ScheduleAI end-to-end smoke test.
#
# Runs the full API contract against a LIVE dev server (started separately or
# via `npm run dev`) with the embedded DB and the MOCK AI provider.
#
# Usage:  bash scripts/smoke.sh [BASE_URL]
#         (BASE_URL defaults to http://localhost:5000)
#
# Exits non-zero on any failure; prints PASS/FAIL per step.
# =============================================================================
set -u

BASE_URL="${1:-http://localhost:5000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_IMAGE="$SCRIPT_DIR/fixtures/test-schedule.png"

JAR_A="$(mktemp)"     # user A cookie jar
JAR_B="$(mktemp)"     # user B cookie jar
BIG_FILE="$(mktemp --suffix=.png)"   # >8MB
BAD_FILE="$(mktemp --suffix=.png)"   # text file masquerading as PNG
TMPDIR_SMOKE="$(mktemp -d)"

PASS=0
FAIL=0
FAILED_STEPS=()

cleanup() {
  rm -f "$JAR_A" "$JAR_B" "$BIG_FILE" "$BAD_FILE"
  rm -rf "$TMPDIR_SMOKE"
}
trap cleanup EXIT

# Unique identities per run so re-runs don't hit the 409 email conflict.
RUN_ID="$(date +%s)$RANDOM"
EMAIL_A="smoke-a-$RUN_ID@example.com"
EMAIL_B="smoke-b-$RUN_ID@example.com"
PASSWORD="smokepass123"

check() {
  # check <step-name> <condition-exit-code>
  local name="$1" code="$2"
  if [ "$code" -eq 0 ]; then
    echo "PASS  $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL  $name"
    FAIL=$((FAIL + 1))
    FAILED_STEPS+=("$name")
  fi
}

# json_get <file> <python-expr using d> — extract a value from a JSON response.
json_get() {
  python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
v = eval(sys.argv[2], {\"d\": d})
print(v if v is not None else '')
" "$1" "$2" 2>/dev/null
}

echo "=============================================="
echo " ScheduleAI smoke test — $BASE_URL"
echo "=============================================="

# ---------------------------------------------------------------------------
echo ""
echo "--- Preflight ---"

# Test image must exist (generate with: npx tsx scripts/gen-test-image.ts)
if [ ! -f "$TEST_IMAGE" ]; then
  echo "FAIL  test image missing at $TEST_IMAGE — run: npx tsx scripts/gen-test-image.ts"
  exit 1
fi
echo "PASS  test image present ($(wc -c < "$TEST_IMAGE") bytes)"

# >8MB file (9MB of PNG-magic-prefixed garbage — must trigger 413 on size)
python3 -c "
import sys
with open('$BIG_FILE','wb') as f:
    f.write(b'\x89PNG\r\n\x1a\n' + b'\x00' * (9 * 1024 * 1024))
"
# Text file with .png extension — must trigger 415/422 on magic-byte sniff
echo "definitely not an image" > "$BAD_FILE"

# Health endpoint
HTTP=$(curl -s -o "$TMPDIR_SMOKE/health.json" -w "%{http_code}" "$BASE_URL/api/health")
[ "$HTTP" = "200" ] && check "GET /api/health → 200" 0 || check "GET /api/health → 200 (got $HTTP)" 1

# Unauthenticated /me → 401
HTTP=$(curl -s -o "$TMPDIR_SMOKE/me0.json" -w "%{http_code}" "$BASE_URL/api/auth/me")
[ "$HTTP" = "401" ] && check "GET /api/auth/me unauthenticated → 401" 0 || check "GET /api/auth/me unauthenticated → 401 (got $HTTP)" 1

# ---------------------------------------------------------------------------
echo ""
echo "--- Auth: register/login/me (user A) ---"

HTTP=$(curl -s -c "$JAR_A" -o "$TMPDIR_SMOKE/reg_a.json" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"firstName\":\"Smoke\",\"lastName\":\"Tester\",\"email\":\"$EMAIL_A\",\"password\":\"$PASSWORD\"}" \
  "$BASE_URL/api/auth/register")
OK=$(json_get "$TMPDIR_SMOKE/reg_a.json" "d.get('success')")
UID_A=$(json_get "$TMPDIR_SMOKE/reg_a.json" "d['data']['user']['id']")
[ "$HTTP" = "201" ] && [ "$OK" = "True" ] && [ -n "$UID_A" ] \
  && check "POST /api/auth/register → 201 + user.id" 0 \
  || check "POST /api/auth/register → 201 + user.id (got $HTTP, success=$OK)" 1

# Registration must NOT sign the user in (they sign in from the login screen).
grep -q "scheduleai_token" "$JAR_A" \
  && check "register sets NO session cookie" 1 \
  || check "register sets NO session cookie" 0

HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/me_a.json" -w "%{http_code}" "$BASE_URL/api/auth/me")
[ "$HTTP" = "401" ] \
  && check "GET /api/auth/me without a session → 401" 0 \
  || check "GET /api/auth/me without a session → 401 (got $HTTP)" 1

# Sign in for real now: the cookie jar must carry the session + the hint.
HTTP=$(curl -s -b "$JAR_A" -c "$JAR_A" -o "$TMPDIR_SMOKE/login_a.json" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_A\",\"password\":\"$PASSWORD\"}" \
  "$BASE_URL/api/auth/login")

grep -q "scheduleai_token" "$JAR_A" \
  && check "login sets scheduleai_token cookie" 0 \
  || check "login sets scheduleai_token cookie" 1

grep -q "scheduleai_hint" "$JAR_A" \
  && check "login sets the readable session-hint cookie" 0 \
  || check "login sets the readable session-hint cookie" 1

HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/me_a.json" -w "%{http_code}" "$BASE_URL/api/auth/me")
ME_ID=$(json_get "$TMPDIR_SMOKE/me_a.json" "d['data']['user']['id']")
[ "$HTTP" = "200" ] && [ "$ME_ID" = "$UID_A" ] \
  && check "GET /api/auth/me with cookie → 200 + matching id" 0 \
  || check "GET /api/auth/me with cookie → 200 + matching id (got $HTTP)" 1

# Login again with the same credentials (fresh jar, proves login works)
JAR_LOGIN="$(mktemp)"
HTTP=$(curl -s -c "$JAR_LOGIN" -o "$TMPDIR_SMOKE/login_a.json" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_A\",\"password\":\"$PASSWORD\"}" \
  "$BASE_URL/api/auth/login")
[ "$HTTP" = "200" ] && check "POST /api/auth/login → 200" 0 || check "POST /api/auth/login → 200 (got $HTTP)" 1

# ---------------------------------------------------------------------------
echo ""
echo "--- Schedules CRUD (user A) ---"

HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/sched.json" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d '{"name":"My First Semester"}' \
  "$BASE_URL/api/schedules")
SCHED_ID=$(json_get "$TMPDIR_SMOKE/sched.json" "d['data']['schedule']['id']")
EC0=$(json_get "$TMPDIR_SMOKE/sched.json" "d['data']['schedule']['entryCount']")
[ "$HTTP" = "201" ] && [ -n "$SCHED_ID" ] && [ "$EC0" = "0" ] \
  && check "POST /api/schedules → 201 + entryCount 0" 0 \
  || check "POST /api/schedules → 201 + entryCount 0 (got $HTTP)" 1

# ---------------------------------------------------------------------------
echo ""
echo "--- Entries + conflicts ---"

HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/e1.json" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Web Development","day":"MONDAY","startTime":"08:00","endTime":"09:30","instructor":"Juan Dela Cruz","room":"Room 201"}' \
  "$BASE_URL/api/schedules/$SCHED_ID/entries")
ENTRY1=$(json_get "$TMPDIR_SMOKE/e1.json" "d['data']['entry']['id']")
COLOR1=$(json_get "$TMPDIR_SMOKE/e1.json" "d['data']['entry']['color']")
[ "$HTTP" = "201" ] && [ -n "$ENTRY1" ] && [[ "$COLOR1" == \#* ]] \
  && check "POST /entries (Web Development MON 08:00-09:30) → 201 + auto color" 0 \
  || check "POST /entries → 201 + auto color (got $HTTP, color=$COLOR1)" 1

# Overlapping second entry on the same day → conflicts[] must flag it
HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/e2.json" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Database Systems","day":"MONDAY","startTime":"09:00","endTime":"10:30","room":"Room 305"}' \
  "$BASE_URL/api/schedules/$SCHED_ID/entries")
ENTRY2=$(json_get "$TMPDIR_SMOKE/e2.json" "d['data']['entry']['id']")
NCONFLICT=$(json_get "$TMPDIR_SMOKE/e2.json" "len(d['data']['conflicts'])")
[ "$HTTP" = "201" ] && [ -n "$ENTRY2" ] && [ "$NCONFLICT" = "1" ] \
  && check "POST overlapping entry → 201 + conflicts length 1" 0 \
  || check "POST overlapping entry → 201 + conflicts length 1 (got $HTTP, conflicts=$NCONFLICT)" 1

# GET entries shows the same conflict (pure recomputation)
HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/elist.json" -w "%{http_code}" \
  "$BASE_URL/api/schedules/$SCHED_ID/entries")
NENTRIES=$(json_get "$TMPDIR_SMOKE/elist.json" "len(d['data']['entries'])")
NCONFLICT=$(json_get "$TMPDIR_SMOKE/elist.json" "len(d['data']['conflicts'])")
[ "$HTTP" = "200" ] && [ "$NENTRIES" = "2" ] && [ "$NCONFLICT" = "1" ] \
  && check "GET /entries → 200 + 2 entries + 1 conflict" 0 \
  || check "GET /entries → 200 + 2 entries + 1 conflict (got $HTTP, entries=$NENTRIES, conflicts=$NCONFLICT)" 1

# ---------------------------------------------------------------------------
echo ""
echo "--- Bulk import (multi-day, with exact duplicate skip) ---"

# 1st bulk: Web Dev MWF (Monday 08:00-09:30 room 201 = EXACT duplicate of
# entry1 → must be skipped), plus 2 new expanded entries (Wed + Fri).
HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/bulk.json" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d '{"entries":[{"subject":"Web Development","days":["MONDAY","WEDNESDAY","FRIDAY"],"startTime":"08:00","endTime":"09:30","room":"Room 201","instructor":"Juan Dela Cruz"},{"subject":"Networking","days":["FRIDAY"],"startTime":"13:00","endTime":"16:00"}]}' \
  "$BASE_URL/api/schedules/$SCHED_ID/entries/bulk")
SAVED=$(json_get "$TMPDIR_SMOKE/bulk.json" "d['data']['saved']")
SKIPPED=$(json_get "$TMPDIR_SMOKE/bulk.json" "d['data']['skipped']")
[ "$HTTP" = "200" ] && [ "$SAVED" = "3" ] && [ "$SKIPPED" = "1" ] \
  && check "POST /entries/bulk → saved 3 (MWF expanded) + skipped 1 (exact dup)" 0 \
  || check "POST /entries/bulk → saved 3 + skipped 1 (got $HTTP, saved=$SAVED, skipped=$SKIPPED)" 1

# ---------------------------------------------------------------------------
echo ""
echo "--- Schedules list (entryCount) ---"

HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/list.json" -w "%{http_code}" "$BASE_URL/api/schedules")
COUNT=$(json_get "$TMPDIR_SMOKE/list.json" "len(d['data']['schedules'])")
ENTRY_COUNT=$(json_get "$TMPDIR_SMOKE/list.json" "[s for s in d['data']['schedules'] if s['id']=='$SCHED_ID'][0]['entryCount']")
[ "$HTTP" = "200" ] && [ "$COUNT" = "1" ] && [ "$ENTRY_COUNT" = "5" ] \
  && check "GET /api/schedules → entryCount 5 for our schedule" 0 \
  || check "GET /api/schedules → entryCount 5 (got $HTTP, count=$COUNT, entryCount=$ENTRY_COUNT)" 1

# ---------------------------------------------------------------------------
echo ""
echo "--- Cross-user isolation (user B) ---"

HTTP=$(curl -s -c "$JAR_B" -o "$TMPDIR_SMOKE/reg_b.json" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"firstName\":\"Other\",\"lastName\":\"User\",\"email\":\"$EMAIL_B\",\"password\":\"$PASSWORD\"}" \
  "$BASE_URL/api/auth/register")
[ "$HTTP" = "201" ] && check "register user B → 201" 0 || check "register user B → 201 (got $HTTP)" 1

# Registering no longer signs anyone in — log B in so the isolation checks
# below run as an AUTHENTICATED other user (404, not 401).
HTTP=$(curl -s -b "$JAR_B" -c "$JAR_B" -o "$TMPDIR_SMOKE/login_b.json" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_B\",\"password\":\"$PASSWORD\"}" \
  "$BASE_URL/api/auth/login")
[ "$HTTP" = "200" ] && check "login user B → 200" 0 || check "login user B → 200 (got $HTTP)" 1

# B reading A's schedule → 404 (no existence leak)
HTTP=$(curl -s -b "$JAR_B" -o "$TMPDIR_SMOKE/b_sched.json" -w "%{http_code}" \
  "$BASE_URL/api/schedules/$SCHED_ID")
[ "$HTTP" = "404" ] && check "user B GET A's schedule → 404" 0 || check "user B GET A's schedule → 404 (got $HTTP)" 1

# B updating A's entry → 404
HTTP=$(curl -s -b "$JAR_B" -o "$TMPDIR_SMOKE/b_entry.json" -w "%{http_code}" \
  -X PUT -H "Content-Type: application/json" \
  -d '{"subject":"Hacked","day":"MONDAY","startTime":"08:00","endTime":"09:00"}' \
  "$BASE_URL/api/schedules/$SCHED_ID/entries/$ENTRY1")
[ "$HTTP" = "404" ] && check "user B PUT A's entry → 404" 0 || check "user B PUT A's entry → 404 (got $HTTP)" 1

# B listing A's entries → 404
HTTP=$(curl -s -b "$JAR_B" -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/schedules/$SCHED_ID/entries")
[ "$HTTP" = "404" ] && check "user B GET A's entries → 404" 0 || check "user B GET A's entries → 404 (got $HTTP)" 1

# ---------------------------------------------------------------------------
echo ""
echo "--- Upload + AI processing (mock provider) ---"

HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/up.json" -w "%{http_code}" \
  -F "image=@$TEST_IMAGE;type=image/png" \
  "$BASE_URL/api/schedule-upload")
UP_ID=$(json_get "$TMPDIR_SMOKE/up.json" "d['data']['upload']['id']")
UP_STATUS=$(json_get "$TMPDIR_SMOKE/up.json" "d['data']['upload']['status']")
UP_URL=$(json_get "$TMPDIR_SMOKE/up.json" "d['data']['upload']['imageUrl']")
[ "$HTTP" = "201" ] && [ -n "$UP_ID" ] && [ "$UP_STATUS" = "PENDING" ] \
  && check "POST /api/schedule-upload → 201 + status PENDING + imageUrl" 0 \
  || check "POST /api/schedule-upload → 201 (got $HTTP, status=$UP_STATUS)" 1

# Owner can fetch the stored image (correct content type)
HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/img.png" -w "%{http_code}" \
  "$BASE_URL$UP_URL")
CTYPE=$(curl -s -b "$JAR_A" -o /dev/null -w "%{content_type}" "$BASE_URL$UP_URL")
MAGIC=$(python3 -c "print(open('$TMPDIR_SMOKE/img.png','rb').read(4).hex())" 2>/dev/null)
[ "$HTTP" = "200" ] && [ "$CTYPE" = "image/png" ] && [ "$MAGIC" = "89504e47" ] \
  && check "GET /schedule-upload/:id/image → 200 image/png (owner only)" 0 \
  || check "GET /schedule-upload/:id/image → 200 image/png (got $HTTP, type=$CTYPE, magic=$MAGIC)" 1

# B cannot fetch A's image → 404
HTTP=$(curl -s -b "$JAR_B" -o /dev/null -w "%{http_code}" "$BASE_URL$UP_URL")
[ "$HTTP" = "404" ] && check "user B GET A's image → 404" 0 || check "user B GET A's image → 404 (got $HTTP)" 1

# Kick the BACKGROUND scan → 202 + PROCESSING (client polls GET /:id after this)
HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/proc.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/schedule-upload/$UP_ID/process")
PSTATUS=$(json_get "$TMPDIR_SMOKE/proc.json" "d['data']['upload']['status']")
[ "$HTTP" = "202" ] && [ "$PSTATUS" = "PROCESSING" ] \
  && check "POST /process → 202 + status PROCESSING (background kick)" 0 \
  || check "POST /process → 202 + PROCESSING (got $HTTP, status=$PSTATUS)" 1

# Poll GET /:id until the background extraction finishes. The window is
# 10 min — the server's own budget for one extraction is ~8 min worst case
# (3 attempts × 120s + backoff) before it falls back to demo data.
PSTATUS=""
for _ in $(seq 1 300); do
  HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/proc.json" -w "%{http_code}" \
    "$BASE_URL/api/schedule-upload/$UP_ID")
  PSTATUS=$(json_get "$TMPDIR_SMOKE/proc.json" "d['data']['upload']['status']")
  if [ "$PSTATUS" = "COMPLETED" ] || [ "$PSTATUS" = "FAILED" ]; then break; fi
  sleep 2
done
PROVIDER=$(json_get "$TMPDIR_SMOKE/proc.json" "d['data'].get('provider')")
NDETECT=$(json_get "$TMPDIR_SMOKE/proc.json" "len(d['data']['entries'])")
[ "$HTTP" = "200" ] && [ "$PSTATUS" = "COMPLETED" ] && { [ "$PROVIDER" = "mock" ] || [ "$PROVIDER" = "gemini" ]; } && [ "$NDETECT" -ge 3 ] \
  && check "GET /:id poll → COMPLETED + provider (mock|gemini) + ≥3 detected entries" 0 \
  || check "GET /:id poll → COMPLETED + mock|gemini + ≥3 entries (got $HTTP, status=$PSTATUS, provider=$PROVIDER, entries=$NDETECT)" 1

# ---------------------------------------------------------------------------
echo ""
echo "--- Upload validation ---"

# Text file as .png → 415 or 422 (magic-byte sniff / empty check)
HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/bad.json" -w "%{http_code}" \
  -F "image=@$BAD_FILE;type=image/png" \
  "$BASE_URL/api/schedule-upload")
if [ "$HTTP" = "415" ] || [ "$HTTP" = "422" ]; then
  check "text file as .png → 415/422 (got $HTTP)" 0
else
  check "text file as .png → 415/422 (got $HTTP)" 1
fi

# 9MB file → 413
HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/big.json" -w "%{http_code}" \
  -F "image=@$BIG_FILE;type=image/png" \
  "$BASE_URL/api/schedule-upload")
[ "$HTTP" = "413" ] && check ">8MB file → 413" 0 || check ">8MB file → 413 (got $HTTP)" 1

# Unsupported mimetype (gif) → 415
HTTP=$(curl -s -b "$JAR_A" -o "$TMPDIR_SMOKE/gif.json" -w "%{http_code}" \
  -F "image=@$TEST_IMAGE;type=image/gif" \
  "$BASE_URL/api/schedule-upload")
[ "$HTTP" = "415" ] && check "disallowed mimetype (gif) → 415" 0 || check "disallowed mimetype (gif) → 415 (got $HTTP)" 1

# ---------------------------------------------------------------------------
echo ""
echo "--- Logout ---"

HTTP=$(curl -s -b "$JAR_A" -c "$JAR_A" -o "$TMPDIR_SMOKE/logout.json" -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/logout")
[ "$HTTP" = "200" ] && check "POST /api/auth/logout → 200" 0 || check "POST /api/auth/logout → 200 (got $HTTP)" 1

HTTP=$(curl -s -b "$JAR_A" -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth/me")
[ "$HTTP" = "401" ] && check "GET /api/auth/me after logout → 401" 0 || check "GET /api/auth/me after logout → 401 (got $HTTP)" 1

# ---------------------------------------------------------------------------
echo ""
echo "=============================================="
echo " RESULT: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo " Failed steps:"
  for s in "${FAILED_STEPS[@]}"; do echo "   - $s"; done
  echo "=============================================="
  exit 1
fi
echo " ALL STEPS PASSED ✅"
echo "=============================================="
exit 0
