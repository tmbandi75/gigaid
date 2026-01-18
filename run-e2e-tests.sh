#!/bin/bash

echo "========================================"
echo "  GigAid E2E Test Runner"
echo "========================================"
echo ""

# Check if app is running
if ! curl -s http://localhost:5000 > /dev/null 2>&1; then
    echo "Error: App is not running on port 5000"
    echo "Please start the app first with 'npm run dev'"
    exit 1
fi

echo "App is running. Starting E2E tests..."
echo ""

# Run Playwright tests
npx playwright test "$@"

# Show results summary
echo ""
echo "========================================"
echo "  Test run complete!"
echo "========================================"
echo ""
echo "To view the HTML report, run:"
echo "  npx playwright show-report"
echo ""
echo "To run tests with UI, run:"
echo "  npx playwright test --ui"
echo ""
