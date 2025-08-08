#!/bin/bash
# Restore script for repos.csv
# This script allows easy reverting to the original repository list

echo "🔄 Repository Restore Script"
echo "=============================="

# Check if backup exists
if [ ! -f "repos.csv.backup" ]; then
    echo "❌ Error: No backup file found (repos.csv.backup)"
    echo "   Cannot restore original repository list"
    exit 1
fi

# Show current status
echo "📊 Current repository count: $(tail -n +2 repos.csv | wc -l)"
echo "📊 Original repository count: $(tail -n +2 repos.csv.backup | wc -l)"
echo ""

# Ask for confirmation
read -p "🔄 Do you want to restore the original repository list? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Restore cancelled"
    exit 0
fi

# Create a backup of current state before restoring
echo "💾 Creating backup of current state..."
cp repos.csv repos.csv.before-restore

# Restore original file
echo "🔄 Restoring original repository list..."
cp repos.csv.backup repos.csv

echo "✅ Repository list restored successfully!"
echo "📊 Current repository count: $(tail -n +2 repos.csv | wc -l)"
echo ""
echo "📝 Files created:"
echo "   - repos.csv.backup (original backup)"
echo "   - repos.csv.before-restore (backup of extended list)"
echo ""
echo "🔄 To restore the extended list again, run:"
echo "   cp repos.csv.before-restore repos.csv"