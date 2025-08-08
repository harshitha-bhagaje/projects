#!/bin/bash
# Show changes made to repository list

echo "🔍 Repository Changes Summary"
echo "============================="

if [ -f "repos.csv.backup" ]; then
    echo "📊 Original repositories ($(tail -n +2 repos.csv.backup | wc -l)):"
    echo "────────────────────────"
    tail -n +2 repos.csv.backup | cut -d',' -f1,2 | sed 's/,/ - /'
    echo ""
fi

echo "📊 Current repositories ($(tail -n +2 repos.csv | wc -l)):"
echo "────────────────────────"
tail -n +2 repos.csv | cut -d',' -f1,2 | sed 's/,/ - /'

if [ -f "repos.csv.backup" ]; then
    echo ""
    echo "🆕 Added repositories:"
    echo "─────────────────────"
    # Show repositories that are in current but not in backup
    comm -13 <(tail -n +2 repos.csv.backup | cut -d',' -f1 | sort) <(tail -n +2 repos.csv | cut -d',' -f1 | sort)
fi

echo ""
echo "🔄 To revert changes: ./restore-repos.sh"