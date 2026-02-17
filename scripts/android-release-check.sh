#!/usr/bin/env bash

echo "Running Android Release Pre-Flight Check..."

ERRORS=0

echo "Scanning for REAL PII logging (logger/console + sensitive fields)..."

PII_REGEX="(email|e-mail|phone|mobile|address|street|zipcode|postal|ssn|social|token|authorization|bearer|firebaseuid|phonee164|emailnormalized|clientphone|clientemail|personalphonenumber)"

LOG_REGEX="(console\.(log|warn|error|debug)|logger\.(info|warn|error|debug))"

MATCHES=$(grep -RIn \
  --exclude-dir={node_modules,dist,build,www,.git,android/app/src/main/assets} \
  --include=\*.{js,ts,tsx} \
  -E "$LOG_REGEX.*$PII_REGEX|$PII_REGEX.*$LOG_REGEX" \
  server client scripts 2>/dev/null)

if [ -n "$MATCHES" ]; then
  echo "❌ Potential PII logging detected:"
  echo "$MATCHES"
  ERRORS=$((ERRORS+1))
else
  echo "✅ No PII logging patterns found."
fi


echo "Checking for google-services.json..."
if [ ! -f android/app/google-services.json ]; then
  echo "❌ google-services.json missing."
  ERRORS=$((ERRORS+1))
else
  echo "✅ google-services.json present."
fi

echo "Checking for keystore.properties..."
if [ ! -f android/keystore.properties ]; then
  echo "❌ keystore.properties missing."
  ERRORS=$((ERRORS+1))
else
  echo "✅ keystore.properties present."
fi

echo ""
echo "=== Summary ==="

if [ $ERRORS -eq 0 ]; then
  echo "✅ Android release check passed."
  exit 0
else
  echo "❌ Android release check failed with $ERRORS error(s)."
  exit 1
fi
